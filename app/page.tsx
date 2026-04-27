"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Gauge, Layers3, ListChecks } from "lucide-react";
import { parsePdcaWorkbookFromArrayBuffer } from "@/lib/pdca-parser";
import { PdcaImportResult, PdcaRecord } from "@/lib/types";
import { ImportLogPanel } from "@/components/pdca/import-log-panel";
import { KpiCard } from "@/components/pdca/kpi-card";
import { TableGridPDCA } from "@/components/pdca/table-grid-pdca";
import { EvidenceDrawer } from "@/components/pdca/evidence-drawer";
import { Sidebar } from "@/components/pdca/sidebar";
import { TopBar } from "@/components/pdca/top-bar";
import { mapApiPdcas } from "@/lib/pdca-front-mapper";
import { useAppState, useFilteredData } from "@/lib/app-state";
import { PortfolioView } from "@/components/pdca/portfolio-view";
import { ImportView } from "@/components/pdca/importacao-view";
import { PersistenciaView } from "@/components/pdca/persistencia-view";
import { PdcaFlowStepper } from "@/components/pdca/pdca-flow-stepper";

type PdcaComputedMetrics = {
  totalSubactions: number;
  doneCount: number;
  progressCount: number;
  pendingCount: number;
  criticalCount: number;
  withDeadline: number;
  withEvidence: number;
  progress: number;
};

type ImportLogEntry = {
  when: string;
  ok: boolean;
  file: string;
  message: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function statusKind(status: string): "done" | "progress" | "pending" | "late" {
  const text = normalizeText(status);
  if (text.includes("conclu")) return "done";
  if (text.includes("execu") || text.includes("aberto") || text.includes("aguard")) return "progress";
  if (text.includes("atras")) return "late";
  return "pending";
}

function countSubacoes(pdca: PdcaRecord): number {
  return Object.values(pdca.fases)
    .flat()
    .reduce((acc, action) => acc + action.subacoes.length, 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function pdcaSubactions(pdca: PdcaRecord) {
  return Object.values(pdca.fases)
    .flat()
    .flatMap((action) => action.subacoes);
}

function hasValue(value: string | undefined): boolean {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return false;
  const normalized = normalizeText(trimmed);
  return normalized !== "n/a" && normalized !== "na" && normalized !== "0";
}

function computePdcaMetrics(pdca: PdcaRecord): PdcaComputedMetrics {
  const subactions = pdcaSubactions(pdca);
  const doneCount = subactions.filter((subaction) => statusKind(subaction.status) === "done").length;
  const progressCount = subactions.filter((subaction) => statusKind(subaction.status) === "progress").length;
  const pendingCount = subactions.filter((subaction) => statusKind(subaction.status) === "pending").length;
  const criticalCount = subactions.filter(
    (subaction) => subaction.gut >= 100 && statusKind(subaction.status) !== "done"
  ).length;
  const withDeadline = subactions.filter((subaction) => hasValue(subaction.meta)).length;
  const withEvidence = subactions.filter((subaction) => hasValue(subaction.resultado)).length;
  const progress = subactions.length ? Math.round((doneCount / subactions.length) * 100) : 0;

  return {
    totalSubactions: subactions.length,
    doneCount,
    progressCount,
    pendingCount,
    criticalCount,
    withDeadline,
    withEvidence,
    progress,
  };
}

function isSupabaseEnvMissing(message: string | undefined): boolean {
  const text = normalizeText(message);
  return text.includes("supabase_url nao definida") || text.includes("supabase_service_role_key nao definida");
}

function mergePdcaRecords(existing: PdcaRecord[], incoming: PdcaRecord[]): PdcaRecord[] {
  const byId = new Map(existing.map((pdca) => [pdca.id, pdca]));
  for (const pdca of incoming) {
    byId.set(pdca.id, pdca);
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id, "pt-BR", { numeric: true }));
}

export default function Page() {
  const { selectedPdcaId, setSelectedPdcaId, selectedSubAction, setSelectedSubAction, activeView, setPdcas, pdcas: appPdcas } = useAppState();
  const { stats: filteredStats, filteredPdcas, filteredSubactions } = useFilteredData();
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pdcas = appPdcas;

  async function loadPdcas() {
    try {
      setLoading(true);
      setMessage("");
      const response = await fetch("/api/pdcas", { method: "GET" });
      const payload = (await response.json()) as { ok: boolean; pdcas?: PdcaRecord[]; message?: string; isDemo?: boolean };

      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Falha ao carregar dados.");
        setLoading(false);
        return;
      }

      if (payload.isDemo && payload.message) {
        setLocalMode(true);
        setMessage(payload.message);
      } else {
        setLocalMode(false);
        setMessage("");
      }

      const pdcaData = payload.pdcas ?? [];
      const normalizedPdcas = mapApiPdcas(pdcaData);
      setPdcas(normalizedPdcas);
      
      if (!selectedPdcaId && normalizedPdcas.length) {
        setSelectedPdcaId(normalizedPdcas[0].id);
      }
      setLoading(false);
    } catch {
      setMessage("Erro de conexão. Tente novamente.");
      setLoading(false);
    }
  }

  function useLocalFallback(parsed: PdcaRecord[], failureMessage: string) {
    setLocalMode(true);
    setPdcas((prev) => mergePdcaRecords(prev, parsed));
    setSelectedPdcaId(parsed[0]?.id || "");
    setMessage(failureMessage);
  }

  useEffect(() => {
    void loadPdcas();
  }, []);

  const stats = filteredStats;

  async function uploadExcelFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((file) => /\.(xlsx|xls|docx|pdf)$/i.test(file.name));
    if (!files.length) return;

    setImporting(true);
    setMessage("");

    const parsed: PdcaRecord[] = [];
    const importResults: PdcaImportResult[] = [];

    for (const file of files) {
      try {
        let pdca: PdcaRecord;
        if (/\.(docx|pdf)$/i.test(file.name)) {
          const endpoint = /\.pdf$/i.test(file.name) ? "/api/parse-pdf" : "/api/parse-docx";
          const form = new FormData();
          form.append("file", file);
          const res = await fetch(endpoint, { method: "POST", body: form });
          const payload = (await res.json()) as {
            ok: boolean; pdca?: PdcaRecord; message?: string; rowCount?: number;
            extractedText?: boolean; preview?: { hasTabela: boolean; detectedId: string | null; charCount: number; sampleLines: string[] }; suggestion?: string;
          };
          if (!payload.ok || !payload.pdca) {
            const detail = payload.suggestion ? ` — ${payload.suggestion}` : "";
            throw new Error((payload.message ?? "Falha ao processar arquivo.") + detail);
          }
          pdca = payload.pdca;
          const ext = file.name.toLowerCase().endsWith(".pdf") ? "PDF" : "DOCX";
          importResults.push({
            ok: true,
            file: file.name,
            message: `PDCA ${pdca.id} importado via ${ext} (${payload.rowCount} subações).`,
            pdca,
          });
        } else {
          const buffer = await file.arrayBuffer();
          pdca = parsePdcaWorkbookFromArrayBuffer(file.name, buffer);
          importResults.push({
            ok: true,
            file: file.name,
            message: `PDCA ${pdca.id} pronto para sincronizar (${countSubacoes(pdca)} subacoes).`,
            pdca,
          });
        }
        parsed.push(pdca);
      } catch (error) {
        importResults.push({
          ok: false,
          file: file.name,
          message: error instanceof Error ? error.message : "Falha ao processar arquivo.",
        });
      }
    }

    if (parsed.length) {
      try {
        const response = await fetch("/api/pdcas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdcas: parsed }),
        });
        const payload = (await response.json()) as { ok: boolean; message?: string };
        if (response.ok && payload.ok) {
          setLocalMode(false);
          setMessage(payload.message ?? "Upload finalizado.");
          await loadPdcas();
        } else if (isSupabaseEnvMissing(payload.message)) {
          useLocalFallback(parsed, "Supabase nao configurado no deploy. Upload carregado apenas nesta sessao local.");
        } else {
          useLocalFallback(parsed, `${payload.message ?? "Falha ao sincronizar com Supabase."} Dados mantidos nesta sessao.`);
        }
      } catch {
        useLocalFallback(parsed, "Falha de rede ao sincronizar com Supabase. Dados mantidos nesta sessao local.");
      }
    } else {
      setMessage("Nenhum arquivo valido foi importado.");
    }

    const now = new Date().toISOString();
    setLogs((prev) => {
      const next = [
        ...importResults.map((result) => ({
          when: now,
          ok: result.ok,
          file: result.file,
          message: result.message,
        })),
        ...prev,
      ];
      return next.slice(0, 30);
    });

    setImporting(false);
  }

  return (
    <div className="min-h-screen bg-[#08192E] text-slate-100">
      <Sidebar
        pdcaCount={stats.pdcaCount}
        subactionCount={stats.subactionCount}
        doneCount={stats.done}
        completion={stats.completion}
        localMode={localMode}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-5 lg:pl-80 lg:pr-8">
        <TopBar
          importing={importing}
          loading={loading}
          localMode={localMode}
          onRefresh={() => void loadPdcas()}
          onOpenImport={() => fileInputRef.current?.click()}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        <input
          ref={fileInputRef}
          hidden
          type="file"
          accept=".xlsx,.xls,.docx,.pdf"
          multiple
          onChange={async (event) => {
            await uploadExcelFiles(event.target.files);
            event.target.value = "";
          }}
        />

        {message ? (
          <section className="mt-4 rounded-2xl border border-[#1E7FD5]/25 bg-[#1E7FD5]/10 px-4 py-3 text-sm text-[#82C4F8]">
            {message}
          </section>
        ) : null}

        {activeView === "painel" && (
          <div className="mt-6">
            <PdcaFlowStepper loading={loading} />
          </div>
        )}

        {activeView === "painel" && (
          <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              title="PDCAs Ativos"
              value={String(stats.excelPdcaCount)}
              subtitle={`${stats.pdcaCount} total no portfolio`}
              gradientClassName="bg-gradient-to-br from-[#1E7FD5] to-[#1565C0]"
              icon={Layers3}
              filter="all"
            />
            <KpiCard
              title="Subacoes"
              value={String(stats.subactionCount)}
              subtitle={`${stats.inProgress} em execucao`}
              gradientClassName="bg-gradient-to-br from-[#82C4F8] via-[#1E7FD5] to-[#1565C0]"
              icon={ListChecks}
              filter="all"
            />
            <KpiCard
              title="Concluidas"
              value={String(stats.done)}
              subtitle={`${stats.pending} pendentes`}
              gradientClassName="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600"
              icon={CheckCircle2}
              filter="done"
            />
            <KpiCard
              title="Em Andamento"
              value={String(stats.inProgress)}
              subtitle={`${stats.late} atrasadas`}
              gradientClassName="bg-gradient-to-br from-amber-500 via-orange-500 to-yellow-500"
              icon={Clock}
              filter="progress"
            />
            <KpiCard
              title="Atrasadas"
              value={String(stats.late)}
              subtitle={`${stats.critical} criticas`}
              gradientClassName="bg-gradient-to-br from-rose-500 via-red-500 to-orange-600"
              icon={AlertTriangle}
              filter="late"
            />
            <KpiCard
              title="Efetividade"
              value={`${stats.completion}%`}
              subtitle={`Media: ${stats.pdcaProgressAverage}%`}
              gradientClassName="bg-gradient-to-br from-[#08192E] via-[#1E7FD5] to-[#82C4F8]"
              icon={Gauge}
              filter="all"
            />
          </section>
        )}

        {activeView === "painel" && (
          <section className="mt-6 rounded-2xl border border-[#1E7FD5]/15 bg-[#08192E]/60 p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-medium text-slate-300">Progresso Geral do PDCA</h3>
                <p className="mt-1 text-xs text-slate-500">{stats.done} de {stats.subactionCount} subações concluídas</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 w-48 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      stats.completion >= 90 ? "bg-emerald-500" :
                      stats.completion >= 70 ? "bg-amber-500" :
                      "bg-rose-500"
                    }`}
                    style={{ width: `${stats.completion}%` }}
                  />
                </div>
                <span className={`text-lg font-semibold ${
                  stats.completion >= 90 ? "text-emerald-400" :
                  stats.completion >= 70 ? "text-amber-400" :
                  "text-rose-400"
                }`}>
                  {stats.completion}%
                </span>
              </div>
            </div>
          </section>
        )}

        {activeView === "painel" && (
          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <TableGridPDCA
              pdcas={pdcas}
              selectedPdcaId={selectedPdcaId}
              onSelectPdca={setSelectedPdcaId}
              loading={loading}
              localMode={localMode}
              onSelectSubAction={(subaction) => {
                setSelectedSubAction(subaction as any);
              }}
            />

            <div className="space-y-5">
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_28px_55px_-35px_rgba(15,23,42,0.9)]">
                <h3 className="text-lg font-semibold text-slate-100">Leituras Executivas</h3>
                <p className="mt-1 text-sm text-slate-400">Sintese dinamica com base nas subacoes do portifolio atual.</p>
                <div className="mt-4 space-y-2 text-sm text-slate-200">
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                    {stats.withEvidence} subacoes com evidencia registrada.
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                    {stats.inProgress} subacoes em execucao no ciclo atual.
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                    {stats.pending} subacoes pendentes para avancar maturidade.
                  </div>
                  <div className="rounded-xl border border-slate-700/80 bg-slate-900/70 px-3 py-2">
                    Eficacia global do portifolio: {stats.completion}%.
                  </div>
                </div>
              </section>

              <ImportLogPanel logs={logs} formatDate={formatDate} />
            </div>
          </section>
        )}

        {activeView === "painel" && (
          <EvidenceDrawer
            isOpen={!!selectedSubAction}
            onClose={() => setSelectedSubAction(null)}
            subAction={selectedSubAction ? {
              id: selectedSubAction.subacaoId,
              pdcaId: selectedPdcaId,
              descricao: selectedSubAction.subacao,
              comoFazer: selectedSubAction.comoFazer || undefined,
              responsavel: selectedSubAction.responsavel,
              prazo: selectedSubAction.prazo,
              status: selectedSubAction.status,
              progresso: selectedSubAction.resultado ? parseInt(selectedSubAction.resultado.replace("%", "")) || 0 : 0,
              evidenciaSgq: selectedSubAction.evidenciaSgq || undefined,
            } : null}
          />
        )}

        {activeView === "portfolio" && (
          <div className="min-h-[calc(100vh-120px)]">
            <PortfolioView
              pdcas={pdcas}
              selectedPdcaId={selectedPdcaId}
              onSelectPdca={setSelectedPdcaId}
              onRefresh={() => void loadPdcas()}
              onImport={() => fileInputRef.current?.click()}
            />
          </div>
        )}

        {activeView === "importacao" && (
          <div className="min-h-[calc(100vh-120px)]">
            <ImportView
              onRefresh={() => void loadPdcas()}
              onImport={() => fileInputRef.current?.click()}
              onDataImported={(newPdcas) => {
                setPdcas((prev) => mergePdcaRecords(prev, newPdcas));
              }}
            />
          </div>
        )}

        {activeView === "persistencia" && (
          <PersistenciaView
            pdcas={pdcas}
            selectedPdcaId={selectedPdcaId}
            onSelectPdca={setSelectedPdcaId}
            onRefresh={() => void loadPdcas()}
            localMode={localMode}
          />
        )}
      </main>
    </div>
  );
}
