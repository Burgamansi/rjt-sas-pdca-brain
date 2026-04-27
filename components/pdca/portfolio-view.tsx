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
  plan:  { bar: "bg-blue-500",    chip: "border-blue-400/40 bg-blue-500/15 text-blue-300" },
  do:    { bar: "bg-emerald-500", chip: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300" },
  check: { bar: "bg-amber-500",   chip: "border-amber-400/40 bg-amber-500/15 text-amber-300" },
  act:   { bar: "bg-rose-500",    chip: "border-rose-400/40 bg-rose-500/15 text-rose-300" },
};

const STATUS_STYLE: Record<string, string> = {
  concluido:    "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
  "em-andamento": "border-amber-400/40 bg-amber-500/15 text-amber-300",
  planejado:    "border-slate-500/40 bg-slate-700/30 text-slate-400",
  atrasado:     "border-rose-400/40 bg-rose-500/15 text-rose-300",
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
    const isExcel = (p: PdcaRecord) => {
      const f = p.fonteArquivo ?? "";
      return f === "Excel Import" || /\.(xlsx|xls)$/i.test(f);
    };
    const excelPdcas = pdcas.filter(isExcel);
    const ativo = excelPdcas.length;
    const concluido = excelPdcas.filter((p) => getPdcaProgress(p) >= 90).length;
    const emAndamento = excelPdcas.filter((p) => getPdcaStatus(p) === "em-andamento").length;
    const atrasado = excelPdcas.filter((p) => {
      const all = getAllSubacoes(p);
      return all.some((s) => (s.status ?? "").toLowerCase().includes("atras"));
    }).length;
    const efetividade = ativo > 0 ? Math.round(excelPdcas.reduce((acc, p) => acc + getPdcaProgress(p), 0) / ativo) : 0;
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
    { label: "PDCAs Ativos", value: stats.ativo, icon: Layers, color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
    { label: "Concluídos", value: stats.concluido, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Em Andamento", value: stats.emAndamento, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { label: "Atrasados", value: stats.atrasado, icon: AlertTriangle, color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
    { label: "Efetividade", value: `${stats.efetividade}%`, icon: Gauge, color: "text-indigo-400", bg: "bg-indigo-500/10 border-indigo-500/20" },
    { label: "Subações", value: stats.totalSubacoes, icon: Calendar, color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Portfolio PDCA</h2>
          <p className="mt-1 text-sm text-slate-400">Visão consolidada do portfólio de ciclos PDCA.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl border border-[#1E7FD5]/20 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button onClick={onImport} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E7FD5] to-[#0066B3] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_16px_rgba(30,127,213,0.3)] hover:from-[#82C4F8] hover:to-[#1E7FD5] transition-all">
            <Upload className="h-4 w-4" /> Importar Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {KPI_ITEMS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-2xl border ${bg} p-4`}>
            <div className="flex items-center gap-2">
              <div className={`rounded-lg bg-[#08192E]/80 p-1.5`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
            </div>
            <p className={`mt-3 text-2xl font-bold tabular-nums ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#1E7FD5]/20 bg-[#08192E]/70 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar PDCA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[#1E7FD5]/20 bg-slate-800/60 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[#1E7FD5]/20 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 focus:border-cyan-500/60 focus:outline-none"
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
          className="rounded-xl border border-[#1E7FD5]/20 bg-slate-800/60 px-3 py-2 text-sm text-slate-300 focus:border-cyan-500/60 focus:outline-none"
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
            className="inline-flex items-center gap-1 rounded-xl border border-[#1E7FD5]/20 px-3 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" /> Limpar
          </button>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Tabela */}
        <div className="overflow-hidden rounded-2xl border border-[#1E7FD5]/20 bg-[#08192E]/70">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1E7FD5]/20 bg-slate-800/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Código</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">PDCA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Fase</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Progresso</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Área</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">Ver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
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
                        className={`cursor-pointer transition-colors hover:bg-slate-800/40 ${isSelected ? "bg-cyan-500/8 ring-1 ring-inset ring-cyan-500/20" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-[#1E7FD5]">{pdca.id}</td>
                        <td className="px-4 py-3 text-white">{(pdca.titulo ?? "-").substring(0, 32)}</td>
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
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-700">
                              <div
                                className={`h-full rounded-full transition-all ${progress >= 90 ? "bg-emerald-500" : progress > 0 ? "bg-amber-500" : "bg-slate-600"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs tabular-nums text-slate-400">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-400">{pdca.area || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <button className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white transition-colors">
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
          <div className="rounded-2xl border border-[#1E7FD5]/20 bg-[#08192E]/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Detalhes do PDCA</h3>
            {selectedPdca ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Código</p>
                  <p className="mt-1 font-mono text-lg font-bold text-[#1E7FD5]">{selectedPdca.id}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Título</p>
                  <p className="mt-1 text-sm text-white">{selectedPdca.titulo || "-"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Fase</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${PHASE_STYLE[getCurrentPhase(selectedPdca)].chip}`}>
                      {PHASE_LABEL[getCurrentPhase(selectedPdca)]}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Status</p>
                    <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[getPdcaStatus(selectedPdca)] ?? ""}`}>
                      {STATUS_LABEL[getPdcaStatus(selectedPdca)] ?? "Planejado"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Progresso</p>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1E7FD5] to-[#0066B3]"
                        style={{ width: `${getPdcaProgress(selectedPdca)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums text-white">{getPdcaProgress(selectedPdca)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Área</p>
                  <p className="mt-1 text-sm text-slate-300">{selectedPdca.area || "-"}</p>
                </div>
                {selectedPdca.situacao && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Situação</p>
                    <p className="mt-1 line-clamp-3 text-xs text-slate-400">{selectedPdca.situacao}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Selecione um PDCA na tabela.</p>
            )}
          </div>

          {/* Distribuição por fase */}
          <div className="rounded-2xl border border-[#1E7FD5]/20 bg-[#08192E]/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Distribuição por Fase</h3>
            <div className="mt-4 space-y-3">
              {phaseDistribution.map(({ phase, count, percent }) => {
                const ps = PHASE_STYLE[phase];
                return (
                  <div key={phase}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={`font-semibold ${ps.chip.split(" ").find((c) => c.startsWith("text-")) ?? "text-slate-300"}`}>
                        {PHASE_LABEL[phase]}
                      </span>
                      <span className="text-slate-500">{count} · {percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                      <div className={`h-full rounded-full ${ps.bar}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-[#1E7FD5]/20 bg-[#08192E]/70 p-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">PDCAs Recentes</h3>
            <div className="mt-4 space-y-2">
              {pdcas.slice(0, 6).map((pdca) => {
                const status = getPdcaStatus(pdca);
                const dot = status === "concluido" ? "bg-emerald-500" : status === "em-andamento" ? "bg-amber-500" : "bg-slate-600";
                return (
                  <button
                    key={pdca.id}
                    onClick={() => onSelectPdca(pdca.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-slate-800/50"
                  >
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${dot}`} />
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-300">{pdca.id} — {(pdca.titulo ?? "").substring(0, 24)}</span>
                    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-600" />
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
