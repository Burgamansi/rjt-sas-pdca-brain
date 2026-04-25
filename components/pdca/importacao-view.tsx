"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, FileText, CheckCircle, XCircle, AlertTriangle, RefreshCw, Save, X, Layers3, ListChecks, Clock, Gauge, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";
import { PdcaRecord, PdcaPhase } from "@/lib/types";
import { T } from "@/lib/tokens";

const COLORS = {
  bg:           T.bg,
  neon:         T.primary,
  neonSecondary:"#1565C0",
  neonGlow:     T.primaryGlow,
  white:        T.text,
  gray:         T.textSub,
  success:      T.success,
  progress:     T.warning,
  error:        T.error,
  warning:      "#FACC15"
};

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

type FileResult = {
  file: File;
  rows: ParsedRow[];
  errors: string[];
  status: "pending" | "parsing" | "ok" | "error";
};

type PdfResult = {
  file: File;
  pdca: PdcaRecord | null;
  rowCount: number;
  error: string;
  status: "pending" | "processing" | "ok" | "error";
};

type ImportMode = "excel" | "pdf";

const faseLabels: Record<PdcaPhase, string> = {
  plan: "PLAN",
  do: "DO",
  check: "CHECK",
  act: "ACT"
};

const faseColors: Record<PdcaPhase, { bg: string; text: string }> = {
  plan: { bg: "bg-blue-500", text: "text-blue-400" },
  do: { bg: "bg-emerald-500", text: "text-emerald-400" },
  check: { bg: "bg-amber-500", text: "text-amber-400" },
  act: { bg: "bg-rose-500", text: "text-rose-400" }
};

const steps: { key: Step; label: string }[] = [
  { key: "upload", label: "Upload" },
  { key: "validacao", label: "Validação" },
  { key: "previa", label: "Prévia" },
  { key: "mapeamento", label: "Mapeamento" },
  { key: "sincronizacao", label: "Sincronização" }
];

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return String(value).trim();
  } catch {
    return "";
  }
}

function safeUpper(value: unknown): string {
  const str = safeString(value);
  try {
    return str.toUpperCase();
  } catch {
    return "";
  }
}

function safeGetField(row: unknown[], idx: number): string {
  if (!Array.isArray(row)) return "";
  const val = row[idx];
  return safeString(val);
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return String(value).trim().toUpperCase();
  } catch {
    return "";
  }
}

function safeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  try {
    return String(value).toLowerCase();
  } catch {
    return "";
  }
}

function parseExcelToRecords(buffer: ArrayBuffer): { rows: ParsedRow[]; errors: string[] } {
  const errors: string[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    
    if (!data || data.length < 2) {
      errors.push("Arquivo vazio ou sem dados");
      return { rows: [], errors };
    }

    const headerRow = data[0].map((h) => normalize(h));
    const findColumn = (patterns: string[]): number => {
      for (const p of patterns) {
        const idx = headerRow.findIndex((h) => h.includes(p));
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

    // Validar colunas obrigatórias
    if (pdcaIdx === -1) errors.push("Coluna PDCA não encontrada");
    if (faseIdx === -1) errors.push("Coluna FASE não encontrada ou vazia");
    if (acaoIdx === -1) errors.push("Coluna ACAO não encontrada");
    if (subacaoIdx === -1) errors.push("Coluna SUBACAO não encontrada");

    if (errors.length > 0) {
      return { rows: [], errors };
    }

    const rows: ParsedRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;

      const faseRaw = faseIdx !== -1 ? normalize(row[faseIdx]) : "";
      let fase: PdcaPhase = "plan";
      if (faseRaw.includes("DO") || faseRaw.includes("EXE")) fase = "do";
      else if (faseRaw.includes("CHECK") || faseRaw.includes("VER")) fase = "check";
      else if (faseRaw.includes("ACT") || faseRaw.includes("COR")) fase = "act";
      else if (faseRaw.includes("PLAN") || faseRaw.includes("PLA")) fase = "plan";

      const pdca = normalize(row[pdcaIdx]);
      const acao = normalize(row[acaoIdx]);
      const subacao = normalize(row[subacaoIdx]);

      // Validar campos obrigatórios por linha
      if (!pdca) {
        errors.push(`Linha ${i + 1}: Coluna PDCA vazia`);
        continue;
      }
      if (!acao) {
        errors.push(`Linha ${i + 1}: Coluna ACAO vazia`);
        continue;
      }
      if (!subacao) {
        errors.push(`Linha ${i + 1}: Coluna SUBACAO vazia`);
        continue;
      }

      rows.push({
        pdca: String(row[pdcaIdx] || "").trim(),
        fase,
        acao: String(row[acaoIdx] || "").trim(),
        subacao: String(row[subacaoIdx] || "").trim(),
        responsavel: respIdx !== -1 ? String(row[respIdx] || "").trim() : "",
        prazo: prazoIdx !== -1 ? String(row[prazoIdx] || "").trim() : "",
        status: statusIdx !== -1 ? (String(row[statusIdx] || "").trim() || "Pendente") : "Pendente"
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
    const fases: Record<PdcaPhase, { id: string; etapa: string; acao: string; subacoes: object[] }[]> = {
      plan: [], do: [], check: [], act: []
    };

    // Group rows by ação within each fase
    const actionMap = new Map<string, { id: string; etapa: string; acao: string; subacoes: object[] }>();

    pdcaRows.forEach((row, rowIdx) => {
      const actionKey = `${row.fase}::${row.acao}`;
      if (!actionMap.has(actionKey)) {
        const newAction = {
          id: `${row.fase.charAt(0).toUpperCase()}${fases[row.fase].length + 1}`,
          etapa: row.fase.toUpperCase(),
          acao: row.acao,
          subacoes: [] as object[],
        };
        actionMap.set(actionKey, newAction);
        fases[row.fase].push(newAction);
      }
      const action = actionMap.get(actionKey)!;
      action.subacoes.push({
        id: `S${row.fase.charAt(0).toUpperCase()}.${rowIdx + 1}`,
        nome: row.subacao,
        resp: row.responsavel,
        gut: 0,
        indicador: "",
        meta: row.prazo || "",
        resultado: "",
        status: row.status,
        prazo: row.prazo || "",
      });
    });

    const statusList = pdcaRows.map(r => r.status.toLowerCase());
    const allDone = statusList.every(s => s.includes("conclu"));
    const anyExec = statusList.some(s => s.includes("exec") || s.includes("andamento"));
    const overallStatus = allDone ? "Concluido" : anyExec ? "Em Execucao" : "Pendente";

    return {
      id,
      titulo: id.substring(0, 100),
      area: pdcaRows[0]?.responsavel || "",
      situacao: `Importado via Excel — ${pdcaRows.length} subações`,
      causas: "",
      analise_gut: { g: 0, u: 0, t: 0, total: 0 },
      fases: fases as PdcaRecord["fases"],
      status: overallStatus,
      fonteArquivo: "Excel Import",
      atualizadoEm: new Date().toISOString()
    };
  });
}

export function ImportView({ onRefresh, onImport, onDataImported }: ImportViewProps) {
  const [importMode, setImportMode] = useState<ImportMode>("excel");
  const [currentStep, setCurrentStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [pdfResults, setPdfResults] = useState<PdfResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleMultipleFiles = useCallback(async (selectedFiles: File[]) => {
    setFile(selectedFiles[0] ?? null);
    setErrors([]);
    setWarnings([]);
    setSuccess(false);
    setCurrentStep("validacao");

    const initial: FileResult[] = selectedFiles.map(f => ({
      file: f,
      rows: [],
      errors: [],
      status: "parsing"
    }));
    setFileResults(initial);

    const updated = [...initial];
    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        const buffer = await selectedFiles[i].arrayBuffer();
        const { rows, errors: parseErrors } = parseExcelToRecords(buffer);
        updated[i] = {
          ...updated[i],
          rows,
          errors: parseErrors,
          status: parseErrors.length > 0 ? "error" : "ok"
        };
      } catch (e) {
        updated[i] = {
          ...updated[i],
          errors: [`Erro ao ler: ${e}`],
          status: "error"
        };
      }
      setFileResults([...updated]);
    }

    const allRows = updated.filter(r => r.status === "ok").flatMap(r => r.rows);
    if (allRows.length > 0) {
      setParsedRows(allRows);
      const duplicateCount = new Set(allRows.map(r => `${r.pdca}-${r.subacao}`)).size;
      if (duplicateCount < allRows.length) {
        setWarnings([`${allRows.length - duplicateCount} duplicados detectados`]);
      }
      setCurrentStep("previa");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(
      f => f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
    );
    if (files.length) {
      handleMultipleFiles(files);
    } else {
      setErrors(["Apenas arquivos .xlsx ou .xls são aceitos"]);
    }
  }, [handleMultipleFiles]);

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) return;

    setImporting(true);
    setCurrentStep("sincronizacao");

    try {
      const pdcas = convertToPdcaRecords(parsedRows);
      // Update local state immediately so the grid reflects the import even if server sync fails
      onDataImported(pdcas);
      const response = await fetch("/api/pdcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdcas })
      });

      if (response.ok) {
        setSuccess(true);
        onRefresh();
      } else {
        setErrors(["Dados importados localmente. Sincronização com servidor falhou."]);
      }
    } catch (e) {
      setErrors([`Dados importados localmente. Erro de rede: ${e}`]);
    } finally {
      setImporting(false);
    }
  }, [parsedRows, onDataImported, onRefresh]);

  const handlePdfFiles = useCallback(async (selectedFiles: File[]) => {
    setErrors([]);
    setSuccess(false);
    setCurrentStep("validacao");

    const initial: PdfResult[] = selectedFiles.map(f => ({
      file: f, pdca: null, rowCount: 0, error: "", status: "processing"
    }));
    setPdfResults(initial);

    const updated = [...initial];
    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        const form = new FormData();
        form.append("file", selectedFiles[i]);
        const res = await fetch("/api/parse-pdf", { method: "POST", body: form });
        const json = await res.json();
        if (json.ok && json.pdca) {
          updated[i] = { ...updated[i], pdca: json.pdca, rowCount: json.rowCount, status: "ok" };
        } else {
          updated[i] = { ...updated[i], error: json.message ?? "Erro ao processar", status: "error" };
        }
      } catch (e) {
        updated[i] = { ...updated[i], error: `Erro: ${e}`, status: "error" };
      }
      setPdfResults([...updated]);
    }

    const validPdcas = updated.filter(r => r.status === "ok" && r.pdca).map(r => r.pdca!);
    if (validPdcas.length > 0) setCurrentStep("previa");
  }, []);

  const handlePdfImport = useCallback(async () => {
    const pdcas = pdfResults.filter(r => r.status === "ok" && r.pdca).map(r => r.pdca!);
    if (pdcas.length === 0) return;
    setImporting(true);
    setCurrentStep("sincronizacao");
    // Update local state immediately so comoFazer appears in the grid even if server sync fails
    onDataImported(pdcas);
    try {
      const res = await fetch("/api/pdcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdcas }),
      });
      if (res.ok) { setSuccess(true); onRefresh(); }
      else setErrors(["Dados importados localmente. Sincronização com servidor falhou."]);
    } catch (e) {
      setErrors([`Dados importados localmente. Erro de rede: ${e}`]);
    } finally {
      setImporting(false);
    }
  }, [pdfResults, onDataImported, onRefresh]);

  const reset = () => {
    setFile(null);
    setFileResults([]);
    setParsedRows([]);
    setPdfResults([]);
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
    <div className="space-y-5" style={{ backgroundColor: COLORS.bg, padding: "16px" }}>
      {/* Header com Glow */}
      <div className="relative rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-6">
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 to-blue-500/5 pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: COLORS.neon }}>
              Importação Inteligente de PDCA
            </h2>
            <p className="mt-2 text-sm" style={{ color: COLORS.gray }}>
              Pipeline de dados → Excel → API → Supabase
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:scale-105"
              style={{ borderColor: COLORS.neon, color: COLORS.neon, backgroundColor: "transparent" }}
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${COLORS.neon}, ${COLORS.neonSecondary})`, boxShadow: `0 0 20px ${COLORS.neonGlow}` }}
            >
              <Upload className="h-4 w-4" />
              Importar Excel
            </button>
          </div>
        </div>
      </div>

      {/* Stepper Pipeline */}
      <div className="flex items-center gap-1 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3">
        {steps.map((step, idx) => {
          const stepIdx = steps.findIndex(s => s.key === currentStep);
          const isActive = idx === stepIdx;
          const isCompleted = idx < stepIdx;
          return (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <div 
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  isCompleted ? "" :
                  isActive ? "" :
                  ""
                }`}
                style={{
                  backgroundColor: isCompleted ? COLORS.success : isActive ? COLORS.neon : "#1a2744",
                  color: isCompleted || isActive ? "#000" : COLORS.gray,
                  boxShadow: isActive ? `0_0_15px_${COLORS.neonGlow}` : "none"
                }}
              >
                {isCompleted ? <CheckCircle className="h-4 w-4" /> : idx + 1}
              </div>
              <span className="text-xs font-medium hidden sm:inline" style={{ color: isActive ? COLORS.white : COLORS.gray }}>
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 flex-1" style={{ color: COLORS.gray }} />
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Main Content */}
        <div className="space-y-5">
          {/* Upload Card com seletor de modo */}
          {currentStep === "upload" && (
            <div className="rounded-2xl border border-[#1E7FD5]/25 bg-[#0E2539]/60 overflow-hidden">
              {/* Tabs Excel / PDF */}
              <div className="flex border-b border-[#1E7FD5]/20">
                {(["excel", "pdf"] as ImportMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setImportMode(mode)}
                    className={`flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-semibold transition-all ${
                      importMode === mode
                        ? "bg-[#1E7FD5]/15 text-white border-b-2 border-[#1E7FD5]"
                        : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                    }`}
                  >
                    {mode === "excel"
                      ? <><FileSpreadsheet className="h-4 w-4" />Excel (.xlsx/.xls)</>
                      : <><FileText className="h-4 w-4" />PDF (.pdf)</>}
                  </button>
                ))}
              </div>

              {/* Drop zone */}
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  const ext = importMode === "excel" ? [".xlsx", ".xls"] : [".pdf"];
                  const files = Array.from(e.dataTransfer.files).filter(f =>
                    ext.some(x => f.name.toLowerCase().endsWith(x))
                  );
                  if (files.length) {
                    importMode === "excel" ? handleMultipleFiles(files) : handlePdfFiles(files);
                  } else {
                    setErrors([`Apenas arquivos ${ext.join(", ")} são aceitos`]);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                className="flex flex-col items-center justify-center py-16 px-8 cursor-pointer"
                onClick={() => importMode === "excel" ? fileInputRef.current?.click() : pdfInputRef.current?.click()}
              >
                <div className="rounded-full p-4 mb-4 bg-[#1E7FD5]/10">
                  {importMode === "excel"
                    ? <FileSpreadsheet className="h-12 w-12 text-[#1E7FD5]" />
                    : <FileText className="h-12 w-12 text-[#82C4F8]" />}
                </div>
                <p className="text-lg font-semibold text-white">
                  {importMode === "excel" ? "Arraste os arquivos Excel aqui" : "Arraste os PDFs de subações aqui"}
                </p>
                <p className="text-sm mt-1 text-slate-400">
                  {importMode === "excel"
                    ? "TABELA_MESTRE.xlsx — múltiplos arquivos permitidos"
                    : "TABELA_MESTRE_PDCA_XX.pdf — múltiplos PDFs permitidos"}
                </p>

                {/* Hidden inputs */}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" multiple hidden
                  onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) handleMultipleFiles(f); e.target.value = ""; }} />
                <input ref={pdfInputRef} type="file" accept=".pdf" multiple hidden
                  onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) handlePdfFiles(f); e.target.value = ""; }} />

                <button
                  onClick={(ev) => { ev.stopPropagation(); importMode === "excel" ? fileInputRef.current?.click() : pdfInputRef.current?.click(); }}
                  className="mt-6 rounded-xl px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#1E7FD5] to-[#0066B3] shadow-[0_0_18px_rgba(30,127,213,0.35)] transition-all hover:from-[#82C4F8] hover:to-[#1E7FD5]"
                >
                  {importMode === "excel" ? "Selecionar Excel" : "Selecionar PDFs"}
                </button>
                <p className="mt-3 text-xs text-slate-600">
                  {importMode === "excel" ? "Aceitos: .xlsx, .xls" : "Aceito: .pdf — gerado a partir de Word/Excel"}
                </p>
              </div>
            </div>
          )}

          {/* File Processing Status */}
          {currentStep === "validacao" && fileResults.length > 0 && (
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>
                  Processando {fileResults.length} arquivo{fileResults.length > 1 ? "s" : ""}...
                </h3>
                <button onClick={reset} className="text-sm hover:underline" style={{ color: COLORS.neon }}>
                  Cancelar
                </button>
              </div>
              <div className="space-y-3">
                {fileResults.map((fr, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
                    <div className="mt-0.5 shrink-0">
                      {fr.status === "parsing" && (
                        <RefreshCw className="h-5 w-5 animate-spin" style={{ color: COLORS.neon }} />
                      )}
                      {fr.status === "ok" && (
                        <CheckCircle className="h-5 w-5" style={{ color: COLORS.success }} />
                      )}
                      {fr.status === "error" && (
                        <XCircle className="h-5 w-5" style={{ color: COLORS.error }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: COLORS.white }}>{fr.file.name}</p>
                      {fr.status === "parsing" && (
                        <p className="text-xs mt-1" style={{ color: COLORS.gray }}>Lendo arquivo...</p>
                      )}
                      {fr.status === "ok" && (
                        <p className="text-xs mt-1" style={{ color: COLORS.success }}>{fr.rows.length} registros encontrados</p>
                      )}
                      {fr.status === "error" && fr.errors.map((err, j) => (
                        <p key={j} className="text-xs mt-1" style={{ color: COLORS.error }}>{err}</p>
                      ))}
                    </div>
                    <span className="text-xs shrink-0" style={{ color: COLORS.gray }}>
                      {(fr.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Processing Status */}
          {importMode === "pdf" && currentStep === "validacao" && pdfResults.length > 0 && (
            <div className="rounded-2xl border border-[#1E7FD5]/25 bg-[#0E2539]/60 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">
                  Processando {pdfResults.length} PDF{pdfResults.length > 1 ? "s" : ""}...
                </h3>
                <button onClick={reset} className="text-sm text-[#82C4F8] hover:underline">Cancelar</button>
              </div>
              <div className="space-y-3">
                {pdfResults.map((pr, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl border border-[#1E7FD5]/15 bg-[#08192E]/50 p-3">
                    <div className="mt-0.5 shrink-0">
                      {pr.status === "processing" && <RefreshCw className="h-5 w-5 animate-spin text-[#1E7FD5]" />}
                      {pr.status === "ok"         && <CheckCircle className="h-5 w-5 text-emerald-400" />}
                      {pr.status === "error"      && <XCircle    className="h-5 w-5 text-rose-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{pr.file.name}</p>
                      {pr.status === "processing" && <p className="text-xs text-slate-500 mt-0.5">Extraindo subações...</p>}
                      {pr.status === "ok"         && <p className="text-xs text-emerald-400 mt-0.5">{pr.rowCount} subações extraídas</p>}
                      {pr.status === "error"      && <p className="text-xs text-rose-400 mt-0.5">{pr.error}</p>}
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{(pr.file.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDF Preview */}
          {importMode === "pdf" && (currentStep === "previa" || currentStep === "mapeamento") &&
            pdfResults.some(r => r.status === "ok") && (
            <div className="rounded-2xl border border-[#1E7FD5]/20 bg-[#0E2539]/60 overflow-hidden">
              <div className="border-b border-[#1E7FD5]/20 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Prévia das Subações Extraídas</h3>
                  <p className="text-sm text-slate-400">
                    {pdfResults.filter(r => r.status === "ok").reduce((s, r) => s + r.rowCount, 0)} subações em{" "}
                    {pdfResults.filter(r => r.status === "ok").length} PDF{pdfResults.filter(r => r.status === "ok").length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#1E7FD5]/8">
                      {["PDCA","Ação","Subação","Responsável","Prazo","Como Fazer"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#82C4F8] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pdfResults.filter(r => r.status === "ok" && r.pdca).flatMap(r =>
                      Object.values(r.pdca!.fases).flat().flatMap(action =>
                        action.subacoes.map(sub => ({
                          pdca: r.pdca!.id,
                          acao: action.acao.slice(0, 40),
                          subacao: sub.nome.slice(0, 60),
                          responsavel: sub.resp,
                          prazo: sub.meta ?? sub.prazo ?? "",
                          comoFazer: sub.comoFazer ? sub.comoFazer.slice(0, 60) + (sub.comoFazer.length > 60 ? "…" : "") : "—",
                        }))
                      )
                    ).slice(0, 12).map((row, i) => (
                      <tr key={i} className="border-b border-[#1E7FD5]/10 hover:bg-[#1E7FD5]/5 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-white">{row.pdca}</td>
                        <td className="px-4 py-2.5 text-slate-400 max-w-[160px] truncate">{row.acao}</td>
                        <td className="px-4 py-2.5 text-slate-300 max-w-[180px] truncate">{row.subacao}</td>
                        <td className="px-4 py-2.5 text-slate-400">{row.responsavel || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-400">{row.prazo || "—"}</td>
                        <td className="px-4 py-2.5 text-slate-500 text-xs max-w-[200px] truncate">{row.comoFazer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PDF Import buttons */}
          {importMode === "pdf" && (currentStep === "previa" || currentStep === "mapeamento") &&
            pdfResults.some(r => r.status === "ok") && (
            <div className="flex items-center justify-between rounded-xl border border-[#1E7FD5]/20 bg-[#0E2539]/60 p-4">
              <button onClick={reset}
                className="flex items-center gap-2 rounded-xl border border-[#1E7FD5]/30 px-4 py-2 text-sm font-medium text-[#82C4F8] hover:bg-[#1E7FD5]/10 transition-all">
                <X className="h-4 w-4" /> Cancelar
              </button>
              <button onClick={handlePdfImport} disabled={importing}
                className="flex items-center gap-2 rounded-xl px-6 py-2 text-sm font-semibold text-white bg-gradient-to-r from-[#1E7FD5] to-[#0066B3] shadow-[0_0_18px_rgba(30,127,213,0.3)] transition-all hover:from-[#82C4F8] hover:to-[#1E7FD5] disabled:opacity-50">
                <Save className="h-4 w-4" />
                {importing ? "Importando..." : `Importar ${pdfResults.filter(r => r.status === "ok").reduce((s, r) => s + r.rowCount, 0)} subações`}
              </button>
            </div>
          )}

          {/* Preview Table (Excel) */}
          {importMode === "excel" && (currentStep === "previa" || currentStep === "mapeamento") && parsedRows.length > 0 && (
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 overflow-hidden">
              <div className="border-b border-cyan-500/20 px-6 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>Prévia dos Dados</h3>
                  <p className="text-sm" style={{ color: COLORS.gray }}>{parsedRows.length} registros encontrados</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ backgroundColor: "rgba(0, 212, 255, 0.05)" }}>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>PDCA</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Fase</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Ação</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Subação</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Responsável</th>
                      <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-b border-cyan-500/10 hover:bg-cyan-500/10 transition-colors">
                        <td className="px-4 py-3 font-medium" style={{ color: COLORS.white }}>{row.pdca}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium text-white ${faseColors[row.fase].bg}`}>
                            {faseLabels[row.fase]}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ color: COLORS.gray }}>{row.acao}</td>
                        <td className="px-4 py-3" style={{ color: COLORS.gray }}>{row.subacao}</td>
                        <td className="px-4 py-3" style={{ color: COLORS.gray }}>{row.responsavel}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full px-2 py-1 text-xs font-medium bg-blue-500/20 text-blue-400">
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 10 && (
                <p className="px-4 py-3 text-sm bg-cyan-950/30" style={{ color: COLORS.gray }}>
                  Mostrando 10 de {parsedRows.length} registros
                </p>
              )}
            </div>
          )}

          {/* Sync Buttons (Excel only) */}
          {importMode === "excel" && (currentStep === "previa" || currentStep === "mapeamento") && (
            <div className="flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
              <button
                onClick={reset}
                className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:bg-cyan-500/10"
                style={{ borderColor: COLORS.neon, color: COLORS.neon }}
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
              <button
                onClick={handleImport}
                disabled={importing || parsedRows.length === 0}
                className="flex items-center gap-2 rounded-lg px-6 py-2 text-sm font-medium text-white transition-all hover:scale-105 disabled:opacity-50"
                style={{ 
                  background: `linear-gradient(135deg, ${COLORS.neon}, ${COLORS.neonSecondary})`,
                  boxShadow: `0 0 20px ${COLORS.neonGlow}`
                }}
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
            <div className="rounded-2xl border border-emerald-500/50 bg-emerald-950/20 p-6" style={{ boxShadow: `0 0 20px rgba(16, 185, 129, 0.2)` }}>
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6" style={{ color: COLORS.success }} />
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>Importação concluída!</h3>
                  <p className="text-sm" style={{ color: COLORS.gray }}>
                    {importMode === "pdf"
                      ? `${pdfResults.filter(r => r.status === "ok").reduce((s, r) => s + r.rowCount, 0)} subações sincronizadas com sucesso.`
                      : `${parsedRows.length} registros sincronizados com sucesso.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* File Info Card */}
          {fileResults.length > 0 && (
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-5">
              <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>Arquivos</h3>
              <div className="mt-4 space-y-4">
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Total</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: COLORS.neon }}>{fileResults.length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase" style={{ color: COLORS.success }}>OK</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: COLORS.success }}>{fileResults.filter(r => r.status === "ok").length}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase" style={{ color: COLORS.error }}>Erro</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: COLORS.error }}>{fileResults.filter(r => r.status === "error").length}</p>
                  </div>
                </div>
                <div className="flex gap-4 border-t border-cyan-500/20 pt-4">
                  <div>
                    <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>PDCAs</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: COLORS.neon }}>{new Set(parsedRows.map(r => r.pdca)).size}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Subações</p>
                    <p className="mt-1 text-lg font-bold" style={{ color: COLORS.neon }}>{parsedRows.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Summary */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-5">
            <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>Validação</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5" style={{ color: COLORS.success }} />
                <span className="text-sm" style={{ color: COLORS.white }}>{parsedRows.length} válidos</span>
              </div>
              {errors.length > 0 && (
                <div className="flex items-center gap-3">
                  <XCircle className="h-5 w-5" style={{ color: COLORS.error }} />
                  <span className="text-sm" style={{ color: COLORS.error }}>{errors.length} erros</span>
                </div>
              )}
              {warnings.length > 0 && (
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5" style={{ color: COLORS.warning }} />
                  <span className="text-sm" style={{ color: COLORS.warning }}>{warnings.length} avisos</span>
                </div>
              )}
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-5">
            <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>Insights</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4" style={{ color: COLORS.neon }} />
                  <span className="text-sm" style={{ color: COLORS.gray }}>Com evidência</span>
                </div>
                <span className="text-sm font-bold" style={{ color: COLORS.neon }}>{stats.withEvidence}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: COLORS.progress }} />
                  <span className="text-sm" style={{ color: COLORS.gray }}>Em execução</span>
                </div>
                <span className="text-sm font-bold" style={{ color: COLORS.progress }}>{stats.inProgress}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4" style={{ color: COLORS.gray }} />
                  <span className="text-sm" style={{ color: COLORS.gray }}>Pendentes</span>
                </div>
                <span className="text-sm font-bold" style={{ color: COLORS.white }}>{stats.pending}</span>
              </div>
              <div className="flex items-center justify-between border-t border-cyan-500/20 pt-4">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4" style={{ color: COLORS.neon }} />
                  <span className="text-sm font-medium" style={{ color: COLORS.white }}>Efetividade</span>
                </div>
                <span className="text-lg font-bold" style={{ color: COLORS.neon }}>{stats.completion}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}