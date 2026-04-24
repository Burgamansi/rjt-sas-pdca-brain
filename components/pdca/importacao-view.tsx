"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle, Info, ChevronRight, RefreshCw, Trash2, Eye, Save, X } from "lucide-react";
import * as XLSX from "xlsx";
import { PdcaRecord, PdcaPhase } from "@/lib/types";

type ImportViewProps = {
  onRefresh: () => void;
  onImport: () => void;
  onDataImported: (pdcas: PdcaRecord[]) => void;
};

type Step = "upload" | "validacao" | "previa" | "mapeamento" | "sincronizacao";

type ParsedRow = {
  pdca: string;
  fase: PdcaPhase;
  acao: string;
  subacao: string;
  responsavel: string;
  prazo: string;
  status: string;
};

const faseLabels: Record<PdcaPhase, string> = {
  plan: "PLAN",
  do: "DO",
  check: "CHECK",
  act: "ACT"
};

const faseColors: Record<PdcaPhase, string> = {
  plan: "bg-blue-500",
  do: "bg-emerald-500",
  check: "bg-amber-500",
  act: "bg-rose-500"
};

const statusColors: Record<string, string> = {
  concluido: "bg-emerald-100 text-emerald-800",
  "em-andamento": "bg-orange-100 text-orange-800",
  pendente: "bg-slate-100 text-slate-600",
  atrasado: "bg-rose-100 text-rose-800"
};

const steps: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "validacao", label: "Validação" },
  { key: "previa", label: "Prévia" },
  { key: "mapeamento", label: "Mapeamento" },
  { key: "sincronizacao", label: "Sincronização" }
];

function parseExcelToRecords(buffer: ArrayBuffer): { rows: ParsedRow[]; errors: string[] } {
  const errors: string[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    if (!data || data.length < 2) {
      errors.push("Arquivo vazio ou sem dados");
      return { rows: [], errors };
    }

    const headerRow = data[0].map((h: any) => String(h || "").toUpperCase().trim());
    const findColumn = (patterns: string[]): number => {
      for (const p of patterns) {
        const idx = headerRow.findIndex((h: string) => h.includes(p));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const pdcaIdx = findColumn(["PDCA", "CODIGO", "COD"]);
    const faseIdx = findColumn(["FASE", "ETAPA", "PHASE"]);
    const acaoIdx = findColumn(["ACAO", "ACAO ", "ACTION"]);
    const subacaoIdx = findColumn(["SUB", "SUBACAO", "SUBACAO ", "SUBACTION"]);
    const respIdx = findColumn(["RESP", "RESPONSAVEL", "RESPONSÁVEL", "OWNER"]);
    const prazoIdx = findColumn(["PRAZO", "DEADLINE", "DATA", "DUE"]);
    const statusIdx = findColumn(["STATUS", "SITUACAO", "SITUAÇÃO"]);

    const rows: ParsedRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const faseRaw = faseIdx !== -1 ? String(row[faseIdx] || "").toUpperCase().trim() : "";
      let fase: PdcaPhase = "plan";
      if (faseRaw.includes("DO") || faseRaw.includes("EXE")) fase = "do";
      else if (faseRaw.includes("CHECK") || faseRaw.includes("VER")) fase = "check";
      else if (faseRaw.includes("ACT") || faseRaw.includes("COR")) fase = "act";
      else if (faseRaw.includes("PLAN") || faseRaw.includes("PLA")) fase = "plan";

      rows.push({
        pdca: pdcaIdx !== -1 ? String(row[pdcaIdx] || "").trim() : "",
        fase,
        acao: acaoIdx !== -1 ? String(row[acaoIdx] || "").trim() : "",
        subacao: subacaoIdx !== -1 ? String(row[subacaoIdx] || "").trim() : "",
        responsavel: respIdx !== -1 ? String(row[respIdx] || "").trim() : "",
        prazo: prazoIdx !== -1 ? String(row[prazoIdx] || "").trim() : "",
        status: statusIdx !== -1 ? String(row[statusIdx] || "").trim() : "Pendente"
      });
    }

    return { rows, errors };
  } catch (e) {
    errors.push(`Erro ao processar: ${e}`);
    return { rows: [], errors };
  }
}

function convertToPdcaRecords(rows: ParsedRow[]): PdcaRecord[] {
  const byPdca = new Map<string, ParsedRow[]>();
  rows.forEach(row => {
    const key = row.pdca || "PDCA-DEFAULT";
    if (!byPdca.has(key)) byPdca.set(key, []);
    byPdca.get(key)!.push(row);
  });

  return Array.from(byPdca.entries()).map(([id, pdcaRows]) => {
    const fases: Record<PdcaPhase, any[]> = {
      plan: [],
      do: [],
      check: [],
      act: []
    };
    pdcaRows.forEach(row => {
      fases[row.fase].push({
        id: `${id}-${row.acao}-${Math.random().toString(36).substr(2, 9)}`,
        etapa: row.fase.toUpperCase() as any,
        acao: row.acao,
        subacoes: [{
          id: `${id}-${row.subacao}-${Math.random().toString(36).substr(2, 9)}`,
          nome: row.subacao,
          resp: row.responsavel,
          gut: 0,
          indicador: "",
          meta: "",
          resultado: "",
          status: row.status
        }]
      });
    });

    const title = pdcaRows[0]?.subacao || id;
    return {
      id,
      titulo: title.substring(0, 100),
      area: pdcaRows[0]?.responsavel || "",
      situacao: pdcaRows[0]?.status || "Pendente",
      causas: "",
      analise_gut: { g: 1, u: 1, t: 1, total: 1 },
      fases,
      status: "Pendente",
      fonteArquivo: "Excel Import",
      atualizadoEm: new Date().toISOString()
    };
  });
}

export function ImportView({ onRefresh, onImport, onDataImported }: ImportViewProps) {
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setErrors([]);
    setWarnings([]);
    setSuccess(false);
    setCurrentStep("validacao");

    try {
      const buffer = await selectedFile.arrayBuffer();
      const { rows, errors: parseErrors } = parseExcelToRecords(buffer);
      
      if (parseErrors.length > 0) {
        setErrors(parseErrors);
        return;
      }

      setParsedRows(rows);
      
      const duplicateCount = new Set(rows.map(r => `${r.pdca}-${r.subacao}`)).size;
      if (duplicateCount < rows.length) {
        setWarnings([`${rows.length - duplicateCount} duplicados detectados`]);
      }

      setCurrentStep("previa");
    } catch (e) {
      setErrors([`Erro ao ler arquivo: ${e}`]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      handleFileSelect(droppedFile);
    } else {
      setErrors(["Apenas arquivos .xlsx ou .xls são aceitos"]);
    }
  }, [handleFileSelect]);

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) return;
    
    setImporting(true);
    setCurrentStep("sincronizacao");

    try {
      const pdcas = convertToPdcaRecords(parsedRows);
      const response = await fetch("/api/pdcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdcas })
      });

      if (response.ok) {
        setSuccess(true);
        onDataImported(pdcas);
        onRefresh();
      } else {
        setErrors(["Erro ao sincronizar com o servidor"]);
      }
    } catch (e) {
      setErrors([`Erro: ${e}`]);
    } finally {
      setImporting(false);
    }
  }, [parsedRows, onDataImported, onRefresh]);

  const reset = () => {
    setFile(null);
    setParsedRows([]);
    setErrors([]);
    setWarnings([]);
    setSuccess(false);
    setCurrentStep("upload");
  };

  const stats = {
    total: parsedRows.length,
    withEvidence: parsedRows.filter(r => r.status !== "Pendente").length,
    inProgress: parsedRows.filter(r => r.status.toLowerCase().includes("exec") || r.status.toLowerCase().includes("andamento")).length,
    pending: parsedRows.filter(r => r.status.toLowerCase().includes("pendente")).length,
    completion: parsedRows.length > 0 ? Math.round((parsedRows.filter(r => r.status.toLowerCase().includes("conclu") || r.status.toLowerCase().includes("done")).length / parsedRows.length) * 100) : 0
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Importação Excel</h2>
          <p className="mt-1 text-sm text-slate-600">Carregar planilhas PDCAs para análise.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onRefresh}
            className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-purple-700"
          >
            <Upload className="h-4 w-4" />
            Importar Excel
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 rounded-2xl bg-white p-4 shadow-sm">
        {steps.map((step, idx) => {
          const stepIdx = steps.findIndex(s => s.key === currentStep);
          const isActive = idx === stepIdx;
          const isCompleted = idx < stepIdx;
          return (
            <div key={step.key} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                isCompleted ? "bg-emerald-500 text-white" :
                isActive ? "bg-blue-600 text-white" :
                "bg-slate-200 text-slate-500"
              }`}>
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : idx + 1}
              </div>
              <span className={`text-sm ${isActive ? "font-semibold text-slate-900" : "text-slate-500"}`}>
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-slate-300" />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div className="space-y-6">
          {/* Upload Card */}
          {currentStep === "upload" && (
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 py-12 transition-colors hover:border-blue-400"
              >
                <FileSpreadsheet className="h-12 w-12 text-slate-400" />
                <p className="mt-4 text-lg font-medium text-slate-700">Arraste o arquivo Excel aqui</p>
                <p className="mt-1 text-sm text-slate-500">ou clique para selecionar</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Selecionar arquivo Excel
                </button>
                <p className="mt-4 text-xs text-slate-400">Aceitos: .xlsx, .xls</p>
              </div>
            </div>
          )}

          {/* Validation */}
          {currentStep === "validacao" && errors.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <XCircle className="h-6 w-6 text-rose-500" />
                <h3 className="text-lg font-semibold text-slate-900">Erros na Validação</h3>
              </div>
              <div className="mt-4 space-y-2">
                {errors.map((err, i) => (
                  <p key={i} className="text-sm text-rose-600">{err}</p>
                ))}
              </div>
              <button onClick={reset} className="mt-4 text-sm text-blue-600 hover:underline">
                Tentar novamente
              </button>
            </div>
          )}

          {/* Preview Table */}
          {(currentStep === "previa" || currentStep === "mapeamento") && parsedRows.length > 0 && (
            <div className="rounded-2xl bg-white shadow-sm overflow-hidden">
              <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
                <h3 className="text-lg font-semibold text-slate-900">Prévia dos Dados</h3>
                <p className="text-sm text-slate-500">{parsedRows.length} registros encontrados</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-4 py-3 text-left font-medium text-slate-600">PDCA</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Fase</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Ação</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Subação</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Responsável</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.pdca}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium text-white ${faseColors[row.fase]}`}>
                            {faseLabels[row.fase]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{row.acao}</td>
                        <td className="px-4 py-3 text-slate-700">{row.subacao}</td>
                        <td className="px-4 py-3 text-slate-600">{row.responsavel}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[row.status.toLowerCase()] || "bg-slate-100 text-slate-600"}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="px-4 py-3 text-sm text-slate-500 bg-slate-50">
                  Mostrando 10 de {parsedRows.length} registros
                </p>
              )}
            </div>
          )}

          {/* Sync */}
          {(currentStep === "previa" || currentStep === "mapeamento") && (
            <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
              <button
                onClick={reset}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || parsedRows.length === 0}
                className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2 text-sm font-medium text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50"
              >
                {importing ? (
                  <>Sincronizando...</>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Importar {parsedRows.length} registros
                  </>
                )}
              </button>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="rounded-2xl bg-emerald-50 p-6 border border-emerald-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
                <div>
                  <h3 className="text-lg font-semibold text-emerald-900">Importação concluída!</h3>
                  <p className="text-sm text-emerald-700">{parsedRows.length} registros sincronizados com sucesso.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* File Info */}
          {file && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Informações do Arquivo</h3>
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Nome</p>
                  <p className="mt-1 text-sm text-slate-700 truncate">{file.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Tamanho</p>
                  <p className="mt-1 text-sm text-slate-700">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">PDCAs detectados</p>
                  <p className="mt-1 text-sm text-slate-700">{new Set(parsedRows.map(r => r.pdca)).size}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Subações detectadas</p>
                  <p className="mt-1 text-sm text-slate-700">{parsedRows.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* Validation Summary */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Validação</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-sm text-slate-700">{parsedRows.length} registros válidos</span>
              </div>
              {errors.length > 0 && (
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5 text-rose-500" />
                  <span className="text-sm text-rose-600">{errors.length} erros</span>
                </div>
              )}
              {warnings.length > 0 && (
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-sm text-amber-600">{warnings.length} avisos</span>
                </div>
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Insights</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Com evidência</span>
                <span className="text-sm font-semibold text-slate-900">{stats.withEvidence}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Em execução</span>
                <span className="text-sm font-semibold text-slate-900">{stats.inProgress}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Pendentes</span>
                <span className="text-sm font-semibold text-slate-900">{stats.pending}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="text-sm font-medium text-slate-700">Efetividade geral</span>
                <span className="text-sm font-bold text-blue-600">{stats.completion}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}