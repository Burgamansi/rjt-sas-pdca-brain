"use client";

import { AlertTriangle, CheckCircle2, Clock, Gauge, Layers3, ListChecks } from "lucide-react";
import { PdcaRecord } from "@/lib/types";
import { PdcaGridRow } from "@/lib/pdca-front-mapper";
import { useFilteredData } from "@/lib/app-state";
import { TableGridPDCA } from "@/components/pdca/table-grid-pdca";
import { PdcaFlowStepper } from "@/components/pdca/pdca-flow-stepper";
import { ImportLogPanel } from "@/components/pdca/import-log-panel";

type ImportLogEntry = {
  when: string;
  ok: boolean;
  file: string;
  message: string;
};

type Props = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  loading: boolean;
  localMode: boolean;
  logs: ImportLogEntry[];
  formatDate: (value: string) => string;
  onSelectSubAction?: (sub: PdcaGridRow) => void;
};

const KPI_CONFIG = [
  { key: "pdcas",      label: "PDCAs Ativos",  colorBg: "bg-[#006AD7]",   Icon: Layers3       },
  { key: "subacoes",   label: "Subações",       colorBg: "bg-[#21277B]",   Icon: ListChecks    },
  { key: "concluidas", label: "Concluídas",     colorBg: "bg-emerald-500", Icon: CheckCircle2  },
  { key: "andamento",  label: "Em Andamento",   colorBg: "bg-amber-500",   Icon: Clock         },
  { key: "atrasadas",  label: "Atrasadas",      colorBg: "bg-rose-500",    Icon: AlertTriangle },
  { key: "eficacia",   label: "Eficácia",       colorBg: "bg-[#5F83B1]",   Icon: Gauge         },
] as const;

const R = 18;
const CIRC = 2 * Math.PI * R;

type DonutSlice = { value: number; color: string; label: string };

function DonutChart({ slices, center }: { slices: DonutSlice[]; center: string }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) {
    return (
      <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-full border-4 border-slate-100 bg-slate-50">
        <span className="text-[10px] text-slate-400">sem dados</span>
      </div>
    );
  }
  let cumulative = 0;
  return (
    <div className="relative flex-shrink-0">
      <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
        {slices.map((sl, i) => {
          if (sl.value === 0) return null;
          const len = (sl.value / total) * CIRC;
          const offset = -cumulative;
          cumulative += len;
          return (
            <circle
              key={i}
              cx="18"
              cy="18"
              r={R}
              fill="none"
              stroke={sl.color}
              strokeWidth="5"
              strokeDasharray={`${len} ${CIRC}`}
              strokeDashoffset={offset}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-slate-900">{center}</span>
      </div>
    </div>
  );
}

export function CommandCenterView({
  pdcas,
  selectedPdcaId,
  onSelectPdca,
  loading,
  localMode,
  logs,
  formatDate,
  onSelectSubAction,
}: Props) {
  const { stats } = useFilteredData();

  const kpiValues: Record<string, string> = {
    pdcas:      String(stats.excelPdcaCount),
    subacoes:   String(stats.subactionCount),
    concluidas: String(stats.done),
    andamento:  String(stats.inProgress),
    atrasadas:  String(stats.late),
    eficacia:   `${stats.completion}%`,
  };

  const kpiSubs: Record<string, string> = {
    pdcas:      `${stats.pdcaCount} no portfólio`,
    subacoes:   `${stats.inProgress} em execução`,
    concluidas: `${stats.pending} pendentes`,
    andamento:  `${stats.late} atrasadas`,
    atrasadas:  `${stats.critical} críticas`,
    eficacia:   `Média: ${stats.pdcaProgressAverage}%`,
  };

  const phaseNames = ["plan", "do", "check", "act"] as const;
  const phaseMatrix = phaseNames.map((phase) => {
    const actions = pdcas.flatMap((p) => p.fases[phase] ?? []);
    const subs = actions.flatMap((a) => a.subacoes);
    const done = subs.filter((s) => s.status.toLowerCase().includes("conclu")).length;
    return { phase: phase.toUpperCase(), total: subs.length, done };
  });

  const evidencePct = stats.subactionCount > 0
    ? Math.round((stats.withEvidence / stats.subactionCount) * 100)
    : 0;

  const statusSlices: DonutSlice[] = [
    { value: stats.done,       color: "#10b981", label: "Concluídas" },
    { value: stats.inProgress, color: "#f59e0b", label: "Andamento"  },
    { value: stats.late,       color: "#ef4444", label: "Atrasadas"  },
    { value: stats.pending,    color: "#94a3b8", label: "Pendentes"  },
  ];

  const coverageSlices: DonutSlice[] = [
    { value: stats.withEvidence,                        color: "#006AD7", label: "Com evidência" },
    { value: stats.subactionCount - stats.withEvidence, color: "#e2e8f0", label: "Sem evidência" },
  ];

  return (
    <div>
      {/* Hero banner */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0B1F4F] via-[#21277B] to-[#006AD7] px-6 py-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
          Painel Executivo · PDCA Brain
        </p>
        <h2 className="mt-1 text-xl font-bold text-white">Visão Command Center</h2>
        <p className="mt-1 text-sm text-white/70">
          {stats.pdcaCount} PDCAs · {stats.subactionCount} subações · eficácia global {stats.completion}%
        </p>
      </div>

      {/* Flat KPI cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {KPI_CONFIG.map(({ key, label, colorBg, Icon }) => (
          <div key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${colorBg}`}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
              <p className="text-xl font-bold leading-none text-slate-900">{kpiValues[key]}</p>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">{kpiSubs[key]}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Jornada Operacional */}
      <div className="mt-5">
        <PdcaFlowStepper loading={loading} />
      </div>

      {/* Charts row */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {/* Status donut */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-700">Status das Subações</p>
          </div>
          <div className="flex items-center gap-4 p-4">
            <DonutChart slices={statusSlices} center={`${stats.completion}%`} />
            <div className="space-y-2">
              {statusSlices.map((sl) => (
                <div key={sl.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: sl.color }} />
                  <span className="text-[11px] text-slate-600">{sl.label}</span>
                  <span className="ml-auto pl-2 text-[11px] font-semibold text-slate-800">{sl.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Phase matrix */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-700">Matriz de Fases</p>
          </div>
          <div className="p-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-2 text-left font-medium text-slate-400">Fase</th>
                  <th className="pb-2 text-right font-medium text-slate-400">Total</th>
                  <th className="pb-2 text-right font-medium text-slate-400">Feitas</th>
                  <th className="pb-2 text-right font-medium text-slate-400">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {phaseMatrix.map((row) => {
                  const pct = row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
                  return (
                    <tr key={row.phase}>
                      <td className="py-2 font-semibold text-slate-700">{row.phase}</td>
                      <td className="py-2 text-right text-slate-500">{row.total}</td>
                      <td className="py-2 text-right text-slate-500">{row.done}</td>
                      <td className={`py-2 text-right font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-500"}`}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Coverage donut */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-700">Cobertura de Evidências</p>
          </div>
          <div className="flex items-center gap-4 p-4">
            <DonutChart slices={coverageSlices} center={`${evidencePct}%`} />
            <div className="space-y-2">
              {coverageSlices.map((sl) => (
                <div key={sl.label} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: sl.color }} />
                  <span className="text-[11px] text-slate-600">{sl.label}</span>
                  <span className="ml-auto pl-2 text-[11px] font-semibold text-slate-800">{sl.value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Table + sidebar */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <TableGridPDCA
          pdcas={pdcas}
          selectedPdcaId={selectedPdcaId}
          onSelectPdca={onSelectPdca}
          loading={loading}
          localMode={localMode}
          onSelectSubAction={onSelectSubAction}
        />

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-800">Leituras Executivas</h3>
            <p className="mt-1 text-sm text-slate-400">Síntese dinâmica com base nas subações do portfólio atual.</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700">
                {stats.withEvidence} subações com evidência registrada.
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700">
                {stats.inProgress} subações em execução no ciclo atual.
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-slate-700">
                {stats.pending} subações pendentes para avançar maturidade.
              </div>
              <div className="rounded-xl border border-[#006AD7]/15 bg-[#006AD7]/5 px-3 py-2 font-medium text-[#006AD7]">
                Eficácia global do portfólio: {stats.completion}%.
              </div>
            </div>
          </section>

          <ImportLogPanel logs={logs} formatDate={formatDate} />
        </div>
      </div>
    </div>
  );
}
