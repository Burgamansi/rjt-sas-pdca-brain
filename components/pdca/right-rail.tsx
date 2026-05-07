"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, TrendingUp, User } from "lucide-react";
import { PdcaRecord } from "@/lib/types";

type Stats = {
  subactionCount: number;
  done: number;
  late: number;
  withEvidence: number;
  completion: number;
  critical: number;
};

type Props = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  stats: Stats;
};

function normalizeStatus(s: string): "done" | "progress" | "late" | "pending" {
  const t = s.toLowerCase();
  if (t.includes("conclu")) return "done";
  if (t.includes("atras") || t.includes("critico")) return "late";
  if (t.includes("exec") || t.includes("andamento")) return "progress";
  return "pending";
}

export function RightRail({ pdcas, selectedPdcaId, onSelectPdca, stats }: Props) {
  const selectedPdca = pdcas.find((p) => p.id === selectedPdcaId) ?? pdcas[0] ?? null;

  const pdcaProgress = useMemo(() => {
    if (!selectedPdca) return 0;
    const subs = Object.values(selectedPdca.fases).flat().flatMap((a) => a.subacoes);
    if (!subs.length) return 0;
    const done = subs.filter((s) => normalizeStatus(s.status) === "done").length;
    return Math.round((done / subs.length) * 100);
  }, [selectedPdca]);

  const topResponsaveis = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>();
    for (const pdca of pdcas) {
      for (const actions of Object.values(pdca.fases)) {
        for (const action of actions) {
          for (const sub of action.subacoes) {
            const name = (sub.resp ?? "").trim();
            if (!name) continue;
            const entry = counts.get(name) ?? { total: 0, done: 0 };
            entry.total++;
            if (normalizeStatus(sub.status) === "done") entry.done++;
            counts.set(name, entry);
          }
        }
      }
    }
    return Array.from(counts.entries())
      .map(([name, { total, done }]) => ({ name, total, done, pct: Math.round((done / total) * 100) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [pdcas]);

  const evidencePct = stats.subactionCount > 0 ? Math.round((stats.withEvidence / stats.subactionCount) * 100) : 0;

  return (
    <aside className="hidden xl:flex fixed right-0 top-0 h-screen w-[304px] flex-col border-l border-slate-200 bg-white z-30">
      <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Intelligence Rail</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 pb-8 space-y-3">
        {/* PDCA em Foco */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">PDCA em Foco</p>
          </div>
          {selectedPdca ? (
            <div className="p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 line-clamp-2">{selectedPdca.titulo || `PDCA ${selectedPdca.id}`}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{selectedPdca.area}</p>
                </div>
                <span className="flex-shrink-0 rounded-full bg-[#006AD7]/10 px-2 py-0.5 text-[10px] font-bold text-[#006AD7]">
                  #{selectedPdca.id}
                </span>
              </div>
              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">Progresso</span>
                  <span className="text-xs font-semibold text-slate-700">{pdcaProgress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#006AD7] transition-all duration-500"
                    style={{ width: `${pdcaProgress}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="px-3 py-4 text-xs text-slate-400">Nenhum PDCA selecionado.</p>
          )}

          {pdcas.length > 0 && (
            <div className="border-t border-slate-100">
              {pdcas.slice(0, 6).map((p) => {
                const subs = Object.values(p.fases).flat().flatMap((a) => a.subacoes);
                const pct = subs.length
                  ? Math.round((subs.filter((s) => normalizeStatus(s.status) === "done").length / subs.length) * 100)
                  : 0;
                const isSelected = p.id === selectedPdcaId;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelectPdca(p.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-slate-50 ${isSelected ? "bg-[#006AD7]/5" : ""}`}
                  >
                    <span className={`flex-shrink-0 text-[10px] font-bold ${isSelected ? "text-[#006AD7]" : "text-slate-400"}`}>
                      #{p.id}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700">{p.titulo || `PDCA ${p.id}`}</span>
                    <span className={`flex-shrink-0 text-[10px] font-semibold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-500"}`}>
                      {pct}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Alertas Operacionais */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Alertas Operacionais</p>
          </div>
          <div className="divide-y divide-slate-100">
            {stats.late > 0 ? (
              <div className="flex items-start gap-2 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-500" />
                <p className="text-[11px] text-slate-700">
                  <span className="font-semibold text-rose-600">{stats.late}</span> subações atrasadas
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 px-3 py-2.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                <p className="text-[11px] text-slate-700">Nenhum item atrasado</p>
              </div>
            )}
            <div className="flex items-start gap-2 px-3 py-2.5">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#006AD7]" />
              <p className="text-[11px] text-slate-700">
                Cobertura de evidência:{" "}
                <span className="font-semibold text-[#006AD7]">{evidencePct}%</span>
              </p>
            </div>
            <div className="flex items-start gap-2 px-3 py-2.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
              <p className="text-[11px] text-slate-700">
                Eficácia global:{" "}
                <span className={`font-semibold ${stats.completion >= 70 ? "text-emerald-600" : "text-amber-600"}`}>
                  {stats.completion}%
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Top Responsáveis */}
        {topResponsaveis.length > 0 && (
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Top Responsáveis</p>
            </div>
            <div className="divide-y divide-slate-100">
              {topResponsaveis.map((r) => (
                <div key={r.name} className="flex items-center gap-2 px-3 py-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#006AD7]/10">
                    <User className="h-3 w-3 text-[#006AD7]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-slate-700">{r.name}</p>
                    <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#006AD7]/60" style={{ width: `${r.pct}%` }} />
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-semibold text-slate-500">
                    {r.done}/{r.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
