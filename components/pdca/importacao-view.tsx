"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import {
  Upload, FileSpreadsheet, FileText, CheckCircle, XCircle,
  AlertTriangle, RefreshCw, Save, X, Layers3, ListChecks,
  Clock, Gauge, Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";
import { PdcaRecord, PdcaPhase } from "@/lib/types";
import { PdcaGridRow, mapPdcaToGridRows } from "@/lib/pdca-front-mapper";
import { useAppState } from "@/lib/app-state";
import { T } from "@/lib/tokens";
import { ExecucaoTab } from "./execucao-tab";
import { AuditoriaTab } from "./auditoria-tab";

const COLORS = {
  bg:            T.bg,
  neon:          T.primary,
  neonSecondary: "#1565C0",
  neonGlow:      T.primaryGlow,
  white:         T.text,
  gray:          T.textSub,
  success:       T.success,
  progress:      T.warning,
  error:         T.error,
  warning:       "#FACC15",
};

type ImportViewProps = {
  onRefresh: () => void;
  onImport: () => void;
  onDataImported: (pdcas: PdcaRecord[]) => void;
  pdcas?: PdcaRecord[];
  onSelectSubAction?: (sub: PdcaGridRow) => void;
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

type ImportTab = "setup" | "estrategia" | "execucao" | "auditoria";

const faseLabels: Record<PdcaPhase, string> = {
  plan: "PLAN",
  do: "DO",
  check: "CHECK",
  act: "ACT",
};

const faseColors: Record<PdcaPhase, { bg: string; text: string }> = {
  plan:  { bg: "bg-blue-500",    text: "text-blue-400" },
  do:    { bg: "bg-emerald-500", text: "text-emerald-400" },
  check: { bg: "bg-amber-500",   text: "text-amber-400" },
  act:   { bg: "bg-rose-500",    text: "text-rose-400" },
};

function safeString(value: unknown): string {
  if (value === null || value === undefined) return "";
  try { return String(value).trim(); } catch { return ""; }
}

function normalize(value: unknown): string {
  if (value === null || value === undefined) return "";
  try { return String(value).trim().toUpperCase(); } catch { return ""; }
}

function parseExcelToRecords(buffer: ArrayBuffer): { rows: ParsedRow[]; errors: string[] } {
  const errors: string[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: "array" });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      errors.push("Nenhuma aba encontrada no arquivo");
      return { rows: [], errors };
    }
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      errors.push("Aba não encontrada");
      return { rows: [], errors };
    }
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

    if (!data || data.length < 2 || !data[0]) {
      errors.push("Arquivo vazio ou sem dados");
      return { rows: [], errors };
    }

    const headerRow = (data[0] ?? []).map((h) => normalize(h));
    const findColumn = (patterns: string[]): number => {
      for (const p of patterns) {
        const idx = headerRow.findIndex((h) => String(h ?? "").includes(p));
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const pdcaIdx    = findColumn(["PDCA", "CODIGO", "COD"]);
    const faseIdx    = findColumn(["FASE", "ETAPA", "PHASE"]);
    const acaoIdx    = findColumn(["ACAO", "ACAO ", "ACTION"]);
    const subacaoIdx = findColumn(["SUB", "SUBACAO", "SUBACAO ", "SUBACTION"]);
    const respIdx    = findColumn(["RESP", "RESPONSAVEL", "RESPONSÁVEL", "OWNER"]);
    const prazoIdx   = findColumn(["PRAZO", "DEADLINE", "DATA", "DUE"]);
    const statusIdx  = findColumn(["STATUS", "SITUACAO", "SITUAÇÃO"]);

    if (pdcaIdx    === -1) errors.push("Coluna PDCA não encontrada");
    if (faseIdx    === -1) errors.push("Coluna FASE não encontrada ou vazia");
    if (acaoIdx    === -1) errors.push("Coluna ACAO não encontrada");
    if (subacaoIdx === -1) errors.push("Coluna SUBACAO não encontrada");

    if (errors.length > 0) return { rows: [], errors };

    const rows: ParsedRow[] = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) continue;

      const faseRaw = faseIdx !== -1 ? normalize(row[faseIdx]) : "";
      let fase: PdcaPhase = "plan";
      if (String(faseRaw ?? "").includes("DO") || String(faseRaw ?? "").includes("EXE")) fase = "do";
      else if (String(faseRaw ?? "").includes("CHECK") || String(faseRaw ?? "").includes("VER")) fase = "check";
      else if (String(faseRaw ?? "").includes("ACT") || String(faseRaw ?? "").includes("COR")) fase = "act";
      else if (String(faseRaw ?? "").includes("PLAN") || String(faseRaw ?? "").includes("PLA")) fase = "plan";

      const pdca   = normalize(row[pdcaIdx]);
      const acao   = normalize(row[acaoIdx]);
      const subacao = normalize(row[subacaoIdx]);

      if (!pdca)   { errors.push(`Linha ${i + 1}: Coluna PDCA vazia`);   continue; }
      if (!acao)   { errors.push(`Linha ${i + 1}: Coluna ACAO vazia`);   continue; }
      if (!subacao){ errors.push(`Linha ${i + 1}: Coluna SUBACAO vazia`); continue; }

      rows.push({
        pdca:        String(row[pdcaIdx]  || "").trim(),
        fase,
        acao:        String(row[acaoIdx]  || "").trim(),
        subacao:     String(row[subacaoIdx] || "").trim(),
        responsavel: respIdx   !== -1 ? String(row[respIdx]   || "").trim() : "",
        prazo:       prazoIdx  !== -1 ? String(row[prazoIdx]  || "").trim() : "",
        status:      statusIdx !== -1 ? (String(row[statusIdx] || "").trim() || "Pendente") : "Pendente",
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
  rows.forEach((row) => {
    const key = safeString(row.pdca) || "PDCA-DEFAULT";
    if (!byPdca.has(key)) byPdca.set(key, []);
    byPdca.get(key)!.push(row);
  });

  return Array.from(byPdca.entries()).map(([id, pdcaRows]) => {
    if (!pdcaRows || pdcaRows.length === 0) return null;

    const fases: Record<PdcaPhase, { id: string; etapa: string; acao: string; subacoes: object[] }[]> = {
      plan: [], do: [], check: [], act: [],
    };

    const actionMap = new Map<string, { id: string; etapa: string; acao: string; subacoes: object[] }>();

    pdcaRows.forEach((row, rowIdx) => {
      const faseKey = safeString(row.fase) || "plan";
      const acaoKey = safeString(row.acao) || "ACAO-DEFAULT";
      const actionKey = `${faseKey}::${acaoKey}`;

      if (!actionMap.has(actionKey)) {
        const newAction = {
          id: `${(faseKey.charAt(0) || "P").toUpperCase()}${fases[faseKey as PdcaPhase]?.length + 1 || 1}`,
          etapa: faseKey.toUpperCase(),
          acao: acaoKey,
          subacoes: [] as object[],
        };
        if (fases[faseKey as PdcaPhase]) {
          actionMap.set(actionKey, newAction);
          fases[faseKey as PdcaPhase].push(newAction);
        }
      }
      const action = actionMap.get(actionKey);
      if (action) {
        action.subacoes.push({
          id: `S${(faseKey.charAt(0) || "P").toUpperCase()}.${rowIdx + 1}`,
          nome: safeString(row.subacao) || "Subação sem nome",
          resp: safeString(row.responsavel) || "",
          gut: 0,
          indicador: "",
          meta: safeString(row.prazo) || "",
          resultado: "",
          status: safeString(row.status) || "Pendente",
          prazo: safeString(row.prazo) || "",
        });
      }
    });

    const statusList = pdcaRows.map((r) => safeString(r.status).toLowerCase());
    const allDone   = statusList.every((s) => s.includes("conclu"));
    const anyExec   = statusList.some((s) => s.includes("exec") || s.includes("andamento"));
    const overallStatus = allDone ? "Concluido" : anyExec ? "Em Execucao" : "Pendente";

    const safeId   = safeString(id) || "PDCA-INVALID";
    const firstRow = pdcaRows[0];

    return {
      id: safeId,
      titulo: safeId.substring(0, 100),
      area: safeString(firstRow?.responsavel) || "Não atribuído",
      situacao: `Importado via Excel — ${pdcaRows.length} subações`,
      causas: "",
      analise_gut: { g: 0, u: 0, t: 0, total: 0 },
      fases: fases as PdcaRecord["fases"],
      status: overallStatus,
      fonteArquivo: "Excel Import",
      atualizadoEm: new Date().toISOString(),
    };
  }).filter((pdca): pdca is PdcaRecord => pdca !== null);
}

/* ───────────────────────────── COMPONENT ───────────────────────────── */

export function ImportView({
  onRefresh,
  onImport,
  onDataImported,
  pdcas: propPdcas,
  onSelectSubAction,
}: ImportViewProps) {
  const { pdcas: appPdcas, clearPdcas } = useAppState();
  const pdcas = propPdcas || appPdcas;

  const [activeTab, setActiveTab] = useState<ImportTab>("setup");
  const [currentStep, setCurrentStep] = useState<"upload" | "validacao" | "previa" | "mapeamento" | "sincronizacao">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [pdfResults, setPdfResults] = useState<PdfResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef  = useRef<HTMLInputElement>(null);

  const totalSubactions = useMemo(
    () => pdcas.reduce((sum, p) => sum + mapPdcaToGridRows(p).length, 0),
    [pdcas]
  );

  const completionPct = parsedRows.length > 0
    ? Math.round(
        parsedRows.filter((r) =>
          String(r.status ?? "").toLowerCase().includes("conclu") ||
          String(r.status ?? "").toLowerCase().includes("done")
        ).length / parsedRows.length * 100
      )
    : 0;

  /* ── handlers ── */

  const handleMultipleFiles = useCallback(async (selectedFiles: File[]) => {
    setFile(selectedFiles[0] ?? null);
    setErrors([]);
    setWarnings([]);
    setSuccess(false);
    setCurrentStep("validacao");

    const initial: FileResult[] = selectedFiles.map((f) => ({
      file: f, rows: [], errors: [], status: "parsing",
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
          status: parseErrors.length > 0 ? "error" : "ok",
        };
      } catch (e) {
        updated[i] = { ...updated[i], errors: [`Erro ao ler: ${e}`], status: "error" };
      }
      setFileResults([...updated]);
    }

    const allRows = updated.filter((r) => r.status === "ok").flatMap((r) => r.rows);
    if (allRows.length > 0) {
      setParsedRows(allRows);
      const duplicateCount = new Set(allRows.map((r) => `${r.pdca}-${r.subacao}`)).size;
      if (duplicateCount < allRows.length)
        setWarnings([`${allRows.length - duplicateCount} duplicados detectados`]);
      setCurrentStep("previa");
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (parsedRows.length === 0) return;
    setImporting(true);
    setCurrentStep("sincronizacao");
    try {
      const records = convertToPdcaRecords(parsedRows);
      onDataImported(records);
      const response = await fetch("/api/pdcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdcas: records }),
      });
      if (response.ok) { setSuccess(true); onRefresh(); }
      else setErrors(["Dados importados localmente. Sincronização com servidor falhou."]);
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

    const initial: PdfResult[] = selectedFiles.map((f) => ({
      file: f, pdca: null, rowCount: 0, error: "", status: "processing",
    }));
    setPdfResults(initial);

    const updated = [...initial];
    for (let i = 0; i < selectedFiles.length; i++) {
      try {
        const form = new FormData();
        form.append("file", selectedFiles[i]);
        const res  = await fetch("/api/parse-pdf", { method: "POST", body: form });
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

    if (updated.some((r) => r.status === "ok")) setCurrentStep("previa");
  }, []);

  const handlePdfImport = useCallback(async () => {
    const records = pdfResults.filter((r) => r.status === "ok" && r.pdca).map((r) => r.pdca!);
    if (records.length === 0) return;
    setImporting(true);
    setCurrentStep("sincronizacao");
    onDataImported(records);
    try {
      const res = await fetch("/api/pdcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdcas: records }),
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

  /* ── render ── */

  const tabs: { key: ImportTab; label: string; badge?: string }[] = [
    { key: "setup",      label: "SETUP EXCEL",   badge: pdcas.length > 0 ? String(pdcas.length) : undefined },
    { key: "estrategia", label: "PDF KNOWLEDGE",  badge: pdfResults.filter((r) => r.status === "ok").length > 0 ? String(pdfResults.filter((r) => r.status === "ok").length) : undefined },
    { key: "execucao",   label: "EXECUÇÃO" },
    { key: "auditoria",  label: "AUDITORIA" },
  ];

  const pdfOcrError = pdfResults.length > 0 &&
    pdfResults.every((r) => r.status === "error") &&
    pdfResults.some((r) => r.error.toLowerCase().includes("escaneada") || r.error.toLowerCase().includes("ocr"));

  return (
    <div className="flex flex-col" style={{ minHeight: "100%", backgroundColor: COLORS.bg }}>

      {/* ── Top action bar ── */}
      <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-3">
        <div>
          <h1 className="text-sm font-bold tracking-wide text-slate-100">
            PDCA SGQ — SISTEMA DE GESTÃO DA QUALIDADE
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {pdcas.length > 0
              ? `${pdcas.length} PDCA${pdcas.length !== 1 ? "s" : ""} · ${totalSubactions} tarefas`
              : "Nenhum PDCA carregado — importe um Excel na aba SETUP"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-white/20 hover:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar
          </button>
          <button
            onClick={handleImport}
            disabled={parsedRows.length === 0 || importing}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700/80 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
          >
            <Save className="h-3.5 w-3.5" />
            SALVAR{parsedRows.length > 0 ? ` (${parsedRows.length})` : ""}
          </button>
          <button
            onClick={() => {
              if (window.confirm("⚠️ ZERAR BASE DE DADOS?\n\nIsso removerá todos os PDCAs do sistema. Esta ação não pode ser desfeita.")) {
                clearPdcas();
                setParsedRows([]);
                setFileResults([]);
                setPdfResults([]);
                setSuccess(false);
                setErrors([]);
              }
            }}
            className="flex items-center gap-1.5 rounded-lg bg-rose-700/70 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            ZERAR BASE
          </button>
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="flex border-b border-white/[0.06] px-5">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 border-b-2 px-4 pb-3 pt-3 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
              activeTab === tab.key
                ? "border-[#1E7FD5] text-[#1E7FD5]"
                : "border-transparent text-slate-500 hover:border-slate-600 hover:text-slate-300"
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="rounded bg-[#1E7FD5]/15 px-1.5 py-0.5 text-[9px] text-[#82C4F8]">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 p-5">

        {/* ════════ TAB 1: SETUP EXCEL ════════ */}
        {activeTab === "setup" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-4">

              {/* Upload drop zone */}
              {currentStep === "upload" && (
                <div
                  className="cursor-pointer overflow-hidden rounded-xl border border-[#1E7FD5]/20 bg-[#0E2539]/60"
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files).filter(
                      (f) => f.name.endsWith(".xlsx") || f.name.endsWith(".xls")
                    );
                    if (files.length) handleMultipleFiles(files);
                    else setErrors(["Apenas arquivos .xlsx ou .xls são aceitos"]);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center justify-center px-8 py-14">
                    <div className="mb-4 rounded-full bg-[#1E7FD5]/10 p-4">
                      <FileSpreadsheet className="h-10 w-10 text-[#1E7FD5]" />
                    </div>
                    <p className="text-base font-semibold text-slate-200">
                      Arraste os arquivos Excel aqui
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      TABELA_MESTRE.xlsx — múltiplos arquivos permitidos
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      multiple
                      hidden
                      onChange={(e) => {
                        const f = Array.from(e.target.files ?? []);
                        if (f.length) handleMultipleFiles(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={(ev) => { ev.stopPropagation(); fileInputRef.current?.click(); }}
                      className="mt-5 rounded-lg bg-[#1E7FD5] px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(30,127,213,0.3)] transition-all hover:bg-[#82C4F8]/80"
                    >
                      Selecionar Excel
                    </button>
                    <p className="mt-3 text-xs text-slate-600">Aceitos: .xlsx, .xls</p>
                  </div>
                </div>
              )}

              {/* File processing status */}
              {currentStep === "validacao" && fileResults.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0E2539]/60 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Processando {fileResults.length} arquivo{fileResults.length > 1 ? "s" : ""}…
                    </h3>
                    <button onClick={reset} className="text-xs text-[#1E7FD5] hover:underline">
                      Cancelar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {fileResults.map((fr, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        {fr.status === "parsing" && <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-[#1E7FD5]" />}
                        {fr.status === "ok"      && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />}
                        {fr.status === "error"   && <XCircle     className="h-4 w-4 shrink-0 text-rose-400" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">{fr.file.name}</p>
                          {fr.status === "parsing" && <p className="text-[11px] text-slate-500">Lendo arquivo…</p>}
                          {fr.status === "ok"      && <p className="text-[11px] text-emerald-400">{fr.rows.length} registros</p>}
                          {fr.status === "error"   && fr.errors.map((err, j) => (
                            <p key={j} className="text-[11px] text-rose-400">{err}</p>
                          ))}
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-600">
                          {(fr.file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview table */}
              {(currentStep === "previa" || currentStep === "mapeamento") && parsedRows.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">Prévia dos Dados</h3>
                      <p className="text-xs text-slate-500">{parsedRows.length} registros detectados</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          {["PDCA", "FASE", "AÇÃO", "SUBAÇÃO", "RESPONSÁVEL", "STATUS"].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 10).map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                          >
                            <td className="px-3 py-2 font-mono text-[10px] text-[#82C4F8]">{row.pdca}</td>
                            <td className="px-3 py-2">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${faseColors[row.fase].bg}`}>
                                {faseLabels[row.fase]}
                              </span>
                            </td>
                            <td className="max-w-[120px] truncate px-3 py-2 text-slate-400">{row.acao}</td>
                            <td className="max-w-[150px] truncate px-3 py-2 text-slate-300">{row.subacao}</td>
                            <td className="px-3 py-2 text-slate-500">{row.responsavel || "—"}</td>
                            <td className="px-3 py-2">
                              <span className="rounded bg-slate-700/60 px-1.5 py-0.5 text-[10px] text-slate-400">
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {parsedRows.length > 10 && (
                    <p className="border-t border-white/[0.04] px-4 py-2 text-[11px] text-slate-600">
                      Mostrando 10 de {parsedRows.length} registros
                    </p>
                  )}
                </div>
              )}

              {/* Import action bar */}
              {(currentStep === "previa" || currentStep === "mapeamento") && parsedRows.length > 0 && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1E7FD5] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_14px_rgba(30,127,213,0.25)] transition-all hover:bg-[#82C4F8]/80 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {importing ? "Importando…" : `Importar ${parsedRows.length} registros`}
                  </button>
                </div>
              )}

              {/* Errors */}
              {errors.length > 0 && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-rose-400" />
                    <h4 className="text-sm font-semibold text-rose-300">Erros</h4>
                  </div>
                  <ul className="space-y-1">
                    {errors.map((e, i) => <li key={i} className="text-xs text-rose-400/80">{e}</li>)}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {warnings.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    <h4 className="text-sm font-semibold text-amber-300">Avisos</h4>
                  </div>
                  <ul className="space-y-1">
                    {warnings.map((w, i) => <li key={i} className="text-xs text-amber-400/80">{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Success */}
              {success && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Importação concluída!</p>
                      <p className="text-xs text-slate-500">
                        {parsedRows.length} registros sincronizados com sucesso.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── SETUP sidebar ── */}
            <div className="space-y-4">

              {/* Hierarchy tree — shown when PDCAs already loaded */}
              {pdcas.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="border-b border-white/[0.06] px-4 py-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      PDCAs Carregados
                    </h3>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {pdcas.map((p) => {
                      const rows = mapPdcaToGridRows(p);
                      const phases = (["plan", "do", "check", "act"] as PdcaPhase[])
                        .map((ph) => ({ phase: ph, count: rows.filter((r) => r.phase === ph).length }))
                        .filter((x) => x.count > 0);
                      return (
                        <div key={p.id} className="border-b border-white/[0.04] px-4 py-3 last:border-0">
                          <p className="font-mono text-[11px] font-semibold text-[#82C4F8]">{p.id}</p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">{p.titulo || "—"}</p>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {phases.map(({ phase, count }) => (
                              <span
                                key={phase}
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${faseColors[phase].bg}/80`}
                              >
                                {faseLabels[phase]} {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-white/[0.04] px-4 py-2.5">
                    <p className="text-[11px] text-slate-600">{totalSubactions} tarefas no total</p>
                  </div>
                </div>
              )}

              {/* Files stats */}
              {fileResults.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Arquivos
                  </h3>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {[
                      { label: "Total", value: fileResults.length,                             color: "text-[#82C4F8]" },
                      { label: "OK",    value: fileResults.filter((r) => r.status === "ok").length,    color: "text-emerald-400" },
                      { label: "Erro",  value: fileResults.filter((r) => r.status === "error").length, color: "text-rose-400" },
                    ].map((s) => (
                      <div key={s.label}>
                        <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] uppercase text-slate-600">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {parsedRows.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-3 text-center">
                      <div>
                        <p className="text-lg font-bold text-[#82C4F8]">
                          {new Set(parsedRows.map((r) => r.pdca)).size}
                        </p>
                        <p className="text-[10px] uppercase text-slate-600">PDCAs</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-[#82C4F8]">{parsedRows.length}</p>
                        <p className="text-[10px] uppercase text-slate-600">Subações</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Validation */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Validação
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-xs text-slate-400">{parsedRows.length} válidos</span>
                  </div>
                  {errors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-rose-400" />
                      <span className="text-xs text-rose-400">{errors.length} erros</span>
                    </div>
                  )}
                  {warnings.length > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-xs text-amber-400">{warnings.length} avisos</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Insights */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Insights
                </h3>
                <div className="space-y-3">
                  {[
                    {
                      label: "Concluídos",
                      value: parsedRows.filter((r) => String(r.status ?? "").toLowerCase().includes("conclu")).length,
                      color: "text-emerald-400",
                    },
                    {
                      label: "Em execução",
                      value: parsedRows.filter((r) => String(r.status ?? "").toLowerCase().includes("exec")).length,
                      color: "text-amber-400",
                    },
                    {
                      label: "Pendentes",
                      value: parsedRows.filter((r) => String(r.status ?? "").toLowerCase().includes("pendente")).length,
                      color: "text-slate-400",
                    },
                  ].map((s) => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">{s.label}</span>
                      <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-white/[0.04] pt-3">
                    <span className="text-xs font-medium text-slate-400">Efetividade</span>
                    <span className="text-base font-bold text-[#1E7FD5]">{completionPct}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB 2: PDF KNOWLEDGE ════════ */}
        {activeTab === "estrategia" && (
          <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">

              {/* PDF upload zone */}
              {currentStep === "upload" && (
                <div
                  className="cursor-pointer overflow-hidden rounded-xl border border-[#1E7FD5]/20 bg-[#0E2539]/60"
                  onDrop={(e) => {
                    e.preventDefault();
                    const files = Array.from(e.dataTransfer.files).filter((f) =>
                      f.name.toLowerCase().endsWith(".pdf")
                    );
                    if (files.length) handlePdfFiles(files);
                    else setErrors(["Apenas arquivos .pdf são aceitos"]);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center justify-center px-8 py-14">
                    <div className="mb-4 rounded-full bg-[#1E7FD5]/10 p-4">
                      <FileText className="h-10 w-10 text-[#82C4F8]" />
                    </div>
                    <p className="text-base font-semibold text-slate-200">
                      Arraste os PDFs de subações aqui
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      TABELA_MESTRE_PDCA_XX.pdf — múltiplos PDFs permitidos
                    </p>
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept=".pdf"
                      multiple
                      hidden
                      onChange={(e) => {
                        const f = Array.from(e.target.files ?? []);
                        if (f.length) handlePdfFiles(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={(ev) => { ev.stopPropagation(); pdfInputRef.current?.click(); }}
                      className="mt-5 rounded-lg bg-[#1E7FD5]/80 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(30,127,213,0.25)] transition-all hover:bg-[#1E7FD5]"
                    >
                      Selecionar PDFs
                    </button>
                    <p className="mt-3 text-xs text-slate-600">
                      Aceito: .pdf — gerado a partir de Word/Excel (texto selecionável)
                    </p>
                  </div>
                </div>
              )}

              {/* PDF processing status */}
              {currentStep === "validacao" && pdfResults.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-[#0E2539]/60 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-200">
                      Processando {pdfResults.length} arquivo{pdfResults.length > 1 ? "s" : ""}…
                    </h3>
                    <button onClick={reset} className="text-xs text-[#1E7FD5] hover:underline">
                      Cancelar
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pdfResults.map((pr, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
                      >
                        {pr.status === "processing" && <RefreshCw className="h-4 w-4 shrink-0 animate-spin text-[#1E7FD5]" />}
                        {pr.status === "ok"         && <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />}
                        {pr.status === "error"      && <XCircle     className="h-4 w-4 shrink-0 text-rose-400" />}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-200">{pr.file.name}</p>
                          {pr.status === "processing" && (
                            <p className="text-[11px] text-slate-500">Extraindo subações…</p>
                          )}
                          {pr.status === "ok" && (
                            <p className="text-[11px] text-emerald-400">{pr.rowCount} subações extraídas</p>
                          )}
                          {pr.status === "error" && (
                            <p className="text-[11px] text-rose-400">
                              {pr.error.toLowerCase().includes("escaneada") || pr.error.toLowerCase().includes("ocr")
                                ? "PDF escaneado — OCR não disponível nesta versão"
                                : pr.error}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-600">
                          {(pr.file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OCR unavailable panel */}
              {pdfOcrError && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
                    <div>
                      <h3 className="text-sm font-semibold text-amber-300">
                        OCR não disponível — PDF escaneado detectado
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-amber-400/80">
                        Os arquivos enviados são PDFs de imagem (escaneados). O parser atual extrai texto
                        apenas de PDFs com camada de texto selecionável, gerados diretamente do Word ou Excel.
                      </p>
                      <p className="mt-2 text-xs text-amber-500/60">
                        <span className="font-semibold">Solução:</span> Exporte o documento original como
                        PDF a partir do Word (.docx → Arquivo → Salvar como → PDF), ou envie o .docx
                        diretamente se disponível.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* PDF preview table */}
              {(currentStep === "previa" || currentStep === "mapeamento") &&
                pdfResults.some((r) => r.status === "ok") && (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="border-b border-white/10 bg-white/[0.03] px-4 py-3">
                    <h3 className="text-sm font-semibold text-slate-200">Prévia das Subações Extraídas</h3>
                    <p className="text-xs text-slate-500">
                      {pdfResults.filter((r) => r.status === "ok").reduce((s, r) => s + r.rowCount, 0)} subações em{" "}
                      {pdfResults.filter((r) => r.status === "ok").length} PDF
                      {pdfResults.filter((r) => r.status === "ok").length > 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                          {["PDCA", "AÇÃO", "SUBAÇÃO", "RESPONSÁVEL", "PRAZO", "COMO FAZER"].map((h) => (
                            <th
                              key={h}
                              className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {pdfResults
                          .filter((r) => r.status === "ok" && r.pdca)
                          .flatMap((r) =>
                            Object.values(r.pdca!.fases).flat().flatMap((action) =>
                              action.subacoes.map((sub) => ({
                                pdca:        r.pdca!.id,
                                acao:        action.acao.slice(0, 35),
                                subacao:     sub.nome.slice(0, 50),
                                responsavel: sub.resp,
                                prazo:       (sub as { meta?: string; prazo?: string }).meta ?? (sub as { prazo?: string }).prazo ?? "",
                                comoFazer:   (sub as { comoFazer?: string }).comoFazer
                                  ? ((sub as { comoFazer: string }).comoFazer.slice(0, 50) + ((sub as { comoFazer: string }).comoFazer.length > 50 ? "…" : ""))
                                  : "—",
                              }))
                            )
                          )
                          .slice(0, 12)
                          .map((row, i) => (
                            <tr
                              key={i}
                              className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]"
                            >
                              <td className="px-3 py-2 font-mono text-[10px] text-[#82C4F8]">{row.pdca}</td>
                              <td className="max-w-[120px] truncate px-3 py-2 text-slate-400">{row.acao}</td>
                              <td className="max-w-[140px] truncate px-3 py-2 text-slate-300">{row.subacao}</td>
                              <td className="px-3 py-2 text-slate-500">{row.responsavel || "—"}</td>
                              <td className="px-3 py-2 text-slate-500">{row.prazo || "—"}</td>
                              <td className="max-w-[160px] truncate px-3 py-2 text-slate-600">{row.comoFazer}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* PDF import action bar */}
              {(currentStep === "previa" || currentStep === "mapeamento") &&
                pdfResults.some((r) => r.status === "ok") && (
                <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-300"
                  >
                    <X className="h-3.5 w-3.5" /> Cancelar
                  </button>
                  <button
                    onClick={handlePdfImport}
                    disabled={importing}
                    className="flex items-center gap-1.5 rounded-lg bg-[#1E7FD5] px-4 py-2 text-xs font-semibold text-white shadow-[0_0_14px_rgba(30,127,213,0.25)] transition-all hover:bg-[#82C4F8]/80 disabled:opacity-50"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {importing
                      ? "Importando…"
                      : `Importar ${pdfResults.filter((r) => r.status === "ok").reduce((s, r) => s + r.rowCount, 0)} subações`}
                  </button>
                </div>
              )}

              {/* PDF success */}
              {success && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-slate-200">Importação concluída!</p>
                      <p className="text-xs text-slate-500">
                        {pdfResults.filter((r) => r.status === "ok").reduce((s, r) => s + r.rowCount, 0)} subações sincronizadas.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── PDF sidebar ── */}
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  PDFs Processados
                </h3>
                {pdfResults.length === 0 ? (
                  <p className="text-xs text-slate-600">Nenhum PDF enviado ainda.</p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: "Total", value: pdfResults.length,                              color: "text-[#82C4F8]" },
                        { label: "OK",    value: pdfResults.filter((r) => r.status === "ok").length,    color: "text-emerald-400" },
                        { label: "Erro",  value: pdfResults.filter((r) => r.status === "error").length, color: "text-rose-400" },
                      ].map((s) => (
                        <div key={s.label}>
                          <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                          <p className="text-[10px] uppercase text-slate-600">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    {pdfResults.filter((r) => r.status === "ok").length > 0 && (
                      <p className="mt-3 text-center text-xs text-slate-500">
                        {pdfResults.filter((r) => r.status === "ok").reduce((s, r) => s + r.rowCount, 0)} subações extraídas
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs text-slate-600">
                <p className="mb-1.5 font-semibold text-slate-500">Sobre o parser PDF</p>
                <p>
                  Detecta blocos{" "}
                  <code className="rounded bg-white/[0.05] px-1 py-0.5 font-mono text-[#82C4F8]">
                    ACTION: XX.XX
                  </code>{" "}
                  para correspondência determinística com IDs do PDCA importado via Excel.
                </p>
                <p className="mt-2 text-slate-700">
                  PDFs escaneados (imagem) não são suportados. Use PDF com texto selecionável.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ════════ TAB 3: EXECUÇÃO ════════ */}
        {activeTab === "execucao" && <ExecucaoTab pdcas={pdcas} />}

        {/* ════════ TAB 4: AUDITORIA ════════ */}
        {activeTab === "auditoria" && <AuditoriaTab pdcas={pdcas} />}

      </div>
    </div>
  );
}
