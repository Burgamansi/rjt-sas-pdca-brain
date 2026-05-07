"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, CheckCircle, ChevronRight, Clock, FileText, Gauge, Layers, RefreshCw, Search, Upload, X } from "lucide-react";
import { PdcaRecord, PdcaPhase } from "@/lib/types";

type PortfolioViewProps = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  onRefresh: () => void;
  onImport: () => void;
};

const PHASE_LABEL: Record<PdcaPhase, string> = { plan: "PLAN", do: "DO", check: "CHECK", act: "ACT" };
const PHASE_STYLE: Record<PdcaPhase, { bar: string; chip: string }> = {
  plan:  { bar: "bg-blue-500",    chip: "border-blue-400/40 bg-blue-500/15 text-blue-700" },
  do:    { bar: "bg-emerald-500", chip: "border-emerald-400/40 bg-emerald-500/15 text-emerald-700" },
  check: { bar: "bg-amber-500",   chip: "border-amber-400/40 bg-amber-500/15 text-amber-700" },
  act:   { bar: "bg-rose-500",    chip: "border-rose-400/40 bg-rose-500/15 text-rose-700" },
};

const STATUS_STYLE: Record<string, string> = {
  concluido:    "border-emerald-400/40 bg-emerald-500/15 text-emerald-700",
  "em-andamento": "border-amber-400/40 bg-amber-500/15 text-amber-700",
  planejado:    "border-slate-300 bg-slate-100 text-slate-500",
  atrasado:     "border-rose-400/40 bg-rose-500/15 text-rose-700",
};
const STATUS_LABEL: Record<string, string> = {
  concluido: "Concluído", "em-andamento": "Em Andamento", planejado: "Planejado", atrasado: "Atrasado",
};

function getAllSubacoes(pdca: PdcaRecord) {
  return (["plan", "do", "check", "act"] as PdcaPhase[]).flatMap((f) =>
    (pdca.fases[f] ?? []).flatMap((a) => a.subacoes ?? [])
  );
}

function getPdcaProgress(pdca: PdcaRecord): number {
  const all = getAllSubacoes(pdca);
  if (!all.length) return 0;
  const done = all.filter((s) => (s.status ?? "").toLowerCase().includes("conclu")).length;
  return Math.round((done / all.length) * 100);
}

function getPdcaStatus(pdca: PdcaRecord): string {
  const p = getPdcaProgress(pdca);
  if (p >= 90) return "concluido";
  if (p > 0) return "em-andamento";
  return "planejado";
}

function getCurrentPhase(pdca: PdcaRecord): PdcaPhase {
  for (const phase of ["plan", "do", "check", "act"] as PdcaPhase[]) {
    const actions = pdca.fases[phase] ?? [];
    const hasPending = actions.some((a) =>
      (a.subacoes ?? []).some((s) => !(s.status ?? "").toLowerCase().includes("conclu"))
    );
    if (hasPending && actions.length > 0) return phase;
  }
  return "act";
}

export function PortfolioView({ pdcas, selectedPdcaId, onSelectPdca, onRefresh, onImport }: PortfolioViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState<PdcaPhase | "all">("all");

  const stats = useMemo(() => {
    const ativo = pdcas.length;
    const concluido = pdcas.filter((p) => getPdcaProgress(p) >= 90).length;
    const emAndamento = pdcas.filter((p) => getPdcaStatus(p) === "em-andamento").length;
    const atrasado = pdcas.filter((p) => {
      const all = getAllSubacoes(p);
      return all.some((s) => (s.status ?? "").toLowerCase().includes("atras"));
    }).length;
    const efetividade = ativo > 0 ? Math.round(pdcas.reduce((acc, p) => acc + getPdcaProgress(p), 0) / ativo) : 0;
    const totalSubacoes = pdcas.reduce((acc, p) => acc + getAllSubacoes(p).length, 0);
    return { ativo, concluido, emAndamento, atrasado, efetividade, totalSubacoes };
  }, [pdcas]);

  const phaseDistribution = useMemo(() => {
    const dist: Record<PdcaPhase, number> = { plan: 0, do: 0, check: 0, act: 0 };
    pdcas.forEach((p) => { dist[getCurrentPhase(p)]++; });
    const total = pdcas.length || 1;
    return (["plan", "do", "check", "act"] as PdcaPhase[]).map((phase) => ({
      phase,
      count: dist[phase],
      percent: Math.round((dist[phase] / total) * 100),
    }));
  }, [pdcas]);

  const filtered = useMemo(() => pdcas.filter((p) => {
    const matchSearch = !search || p.id.toLowerCase().includes(search.toLowerCase()) || (p.titulo ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || getPdcaStatus(p) === statusFilter;
    const matchPhase = phaseFilter === "all" || getCurrentPhase(p) === phaseFilter;
    return matchSearch && matchStatus && matchPhase;
  }), [pdcas, search, statusFilter, phaseFilter]);

  const selectedPdca = pdcas.find((p) => p.id === selectedPdcaId);

  const KPI_ITEMS = [
    { label: "PDCAs Ativos",  value: stats.ativo,         icon: Layers,        color: "text-sky-600",    bg: "bg-sky-500/10 border-sky-400/30" },
    { label: "Concluídos",    value: stats.concluido,     icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-400/30" },
    { label: "Em Andamento",  value: stats.emAndamento,   icon: Clock,         color: "text-amber-600",  bg: "bg-amber-500/10 border-amber-400/30" },
    { label: "Atrasados",     value: stats.atrasado,      icon: AlertTriangle, color: "text-rose-600",   bg: "bg-rose-500/10 border-rose-400/30" },
    { label: "Efetividade",   value: `${stats.efetividade}%`, icon: Gauge,     color: "text-indigo-600", bg: "bg-indigo-500/10 border-indigo-400/30" },
    { label: "Subações",      value: stats.totalSubacoes, icon: Calendar,      color: "text-purple-600", bg: "bg-purple-500/10 border-purple-400/30" },
  ];

  return (
    <div className="mt-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Portfolio PDCA</h2>
          <p className="mt-1 text-sm text-slate-500">Visão consolidada do portfólio de ciclos PDCA.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button
            onClick={onImport}
            className="inline-flex items-center gap-2 rounded-xl bg-[#006AD7] px-4 py-2 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(0,106,215,0.3)] hover:bg-[#0059B3] transition-all"
          >
            <Upload className="h-4 w-4" /> Importar Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {KPI_ITEMS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border ${bg} bg-white p-4`}>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-slate-100 p-1.5">
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            </div>
            <p className={`mt-3 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar PDCA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#006AD7]/50 focus:outline-none focus:ring-1 focus:ring-[#006AD7]/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#006AD7]/50 focus:outline-none"
        >
          <option value="all">Todos os Status</option>
          <option value="concluido">Concluído</option>
          <option value="em-andamento">Em Andamento</option>
          <option value="planejado">Planejado</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value as PdcaPhase | "all")}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-[#006AD7]/50 focus:outline-none"
        >
          <option value="all">Todas as Fases</option>
          <option value="plan">PLAN</option>
          <option value="do">DO</option>
          <option value="check">CHECK</option>
          <option value="act">ACT</option>
        </select>
        {(search || statusFilter !== "all" || phaseFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("all"); setPhaseFilter("all"); }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Tabela */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">PDCA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Fase</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Progresso</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Área</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Nenhum PDCA encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((pdca) => {
                    const progress = getPdcaProgress(pdca);
                    const status = getPdcaStatus(pdca);
                    const fase = getCurrentPhase(pdca);
                    const ps = PHASE_STYLE[fase];
                    const isSelected = pdca.id === selectedPdcaId;
                    return (
                      <tr
                        key={pdca.id}
                        onClick={() => onSelectPdca(pdca.id)}
                        className={`cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? "bg-[#006AD7]/6 ring-1 ring-inset ring-[#006AD7]/20" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-[#006AD7]">{pdca.id}</td>
                        <td className="px-4 py-3 text-slate-800">{(pdca.titulo ?? "-").substring(0, 32)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${ps.chip}`}>
                            {PHASE_LABEL[fase]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] ?? ""}`}>
                            {STATUS_LABEL[status] ?? status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full transition-all ${progress >= 90 ? "bg-emerald-500" : progress > 0 ? "bg-amber-500" : "bg-slate-300"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-slate-500">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{pdca.area || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
                            <FileText className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">
          {/* Detalhes */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalhes do PDCA</h3>
            </div>
            <div className="p-4">
              {selectedPdca ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Código</p>
                    <p className="mt-1 font-mono text-lg font-bold text-[#006AD7]">{selectedPdca.id}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Título</p>
                    <p className="mt-1 text-sm text-slate-800">{selectedPdca.titulo || "-"}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Fase</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${PHASE_STYLE[getCurrentPhase(selectedPdca)].chip}`}>
                        {PHASE_LABEL[getCurrentPhase(selectedPdca)]}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Status</p>
                      <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[getPdcaStatus(selectedPdca)] ?? ""}`}>
                        {STATUS_LABEL[getPdcaStatus(selectedPdca)] ?? "Planejado"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Progresso</p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#006AD7] to-[#0054AA]"
                          style={{ width: `${getPdcaProgress(selectedPdca)}%` }}
                        />
                      </div>
                      <span className="text-sm font-bold tabular-nums text-slate-800">{getPdcaProgress(selectedPdca)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Área</p>
                    <p className="mt-1 text-sm text-slate-600">{selectedPdca.area || "-"}</p>
                  </div>
                  {selectedPdca.situacao && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Situação</p>
                      <p className="mt-1 line-clamp-3 text-xs text-slate-500">{selectedPdca.situacao}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-400">Selecione um PDCA na tabela.</p>
              )}
            </div>
          </div>

          {/* Distribuição por fase */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Distribuição por Fase</h3>
            </div>
            <div className="p-4 space-y-3">
              {phaseDistribution.map(({ phase, count, percent }) => {
                const ps = PHASE_STYLE[phase];
                return (
                  <div key={phase}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-semibold ${ps.chip.split(" ").find((c) => c.startsWith("text-")) ?? "text-slate-700"}`}>
                        {PHASE_LABEL[phase]}
                      </span>
                      <span className="text-slate-400">{count} · {percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${ps.bar}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDCAs Recentes */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">PDCAs Recentes</h3>
            </div>
            <div className="p-2 space-y-0.5">
              {pdcas.slice(0, 6).map((pdca) => {
                const status = getPdcaStatus(pdca);
                const dot = status === "concluido" ? "bg-emerald-500" : status === "em-andamento" ? "bg-amber-500" : "bg-slate-300";
                return (
                  <button
                    key={pdca.id}
                    onClick={() => onSelectPdca(pdca.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{pdca.id} — {(pdca.titulo ?? "").substring(0, 24)}</span>
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
