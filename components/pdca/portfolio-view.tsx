"use client";

import { useMemo, useState } from "react";
import { Search, RefreshCw, Upload, FileText, ChevronRight, CheckCircle, Clock, AlertTriangle, Layers, Gauge, Calendar } from "lucide-react";
import { PdcaRecord, PdcaPhase } from "@/lib/types";

type PortfolioViewProps = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  onRefresh: () => void;
  onImport: () => void;
};

const phaseLabels: Record<PdcaPhase, string> = {
  plan: "Plan",
  do: "Execute",
  check: "Check",
  act: "Act"
};

const phaseColors: Record<PdcaPhase, string> = {
  plan: "bg-blue-500",
  do: "bg-emerald-500",
  check: "bg-amber-500",
  act: "bg-rose-500"
};

const statusConfig: Record<string, { label: string; className: string }> = {
  concluido: { label: "Concluído", className: "bg-emerald-100 text-emerald-800" },
  "em-andamento": { label: "Em Andamento", className: "bg-orange-100 text-orange-800" },
  planejado: { label: "Planejado", className: "bg-slate-100 text-slate-600" },
  atrasado: { label: "Atrasado", className: "bg-rose-100 text-rose-800" }
};

function getPdcaProgress(pdca: PdcaRecord): number {
  const allSubacoes = [
    ...(pdca.fases.plan || []).flatMap(a => a.subacoes || []),
    ...(pdca.fases.do || []).flatMap(a => a.subacoes || []),
    ...(pdca.fases.check || []).flatMap(a => a.subacoes || []),
    ...(pdca.fases.act || []).flatMap(a => a.subacoes || [])
  ];
  if (allSubacoes.length === 0) return 0;
  const concluidas = allSubacoes.filter(s => s.status?.toLowerCase().includes("conclu") || s.status?.toLowerCase().includes("done")).length;
  return Math.round((concluidas / allSubacoes.length) * 100);
}

function getPdcaStatus(pdca: PdcaRecord): string {
  const progress = getPdcaProgress(pdca);
  if (progress >= 90) return "concluido";
  if (progress > 0) return "em-andamento";
  return "planejado";
}

function getCurrentPhase(pdca: PdcaRecord): PdcaPhase {
  const phases: PdcaPhase[] = ["plan", "do", "check", "act"];
  for (const phase of phases) {
    const actions = pdca.fases[phase] || [];
    const hasPending = actions.some(a => (a.subacoes || []).some(s => !s.status?.toLowerCase().includes("conclu")));
    if (hasPending && actions.length > 0) return phase;
  }
  return "act";
}

export function PortfolioView({ pdcas, selectedPdcaId, onSelectPdca, onRefresh, onImport }: PortfolioViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [phaseFilter, setPhaseFilter] = useState("all");

const stats = useMemo(() => {
    const ativo = pdcas.length;
    const concluido = pdcas.filter(p => getPdcaProgress(p) >= 90).length;
    const emAndamento = pdcas.filter(p => getPdcaStatus(p) === "em-andamento").length;
    const atrasado = pdcas.filter(p => {
      const fase = getCurrentPhase(p);
      const actions = p.fases[fase] || [];
      return actions.some(a => (a.subacoes || []).some((s: any) => s.status?.toLowerCase().includes("atras")));
    }).length;
    const efetividade = ativo > 0 ? Math.round(pdcas.reduce((acc, p) => acc + getPdcaProgress(p), 0) / ativo) : 0;
    const prazos = pdcas.flatMap(p => [
      ...(p.fases.plan || []).flatMap(a => a.subacoes || []),
      ...(p.fases.do || []).flatMap(a => a.subacoes || []),
      ...(p.fases.check || []).flatMap(a => a.subacoes || []),
      ...(p.fases.act || []).flatMap(a => a.subacoes || [])
    ].map(s => (s as any).prazo)).filter(Boolean);
    const prazoMedio = prazos.length > 0 ? Math.round(prazos.length / 2) : 0;
    return { ativo, concluido, emAndamento, atrasado, efetividade, prazoMedio };
  }, [pdcas]);

  const phaseDistribution = useMemo(() => {
    const phases: PdcaPhase[] = ["plan", "do", "check", "act"];
    const dist: Record<PdcaPhase, number> = { plan: 0, do: 0, check: 0, act: 0 };
    pdcas.forEach(p => {
      const fase = getCurrentPhase(p);
      dist[fase]++;
    });
    const total = pdcas.length || 1;
    return phases.map(phase => ({
      phase,
      count: dist[phase],
      percent: Math.round((dist[phase] / total) * 100)
    }));
  }, [pdcas]);

  const filteredPdcas = useMemo(() => {
    return pdcas.filter(p => {
      const matchSearch = !search || p.id.toLowerCase().includes(search.toLowerCase()) || p.titulo?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || getPdcaStatus(p) === statusFilter;
      const matchPhase = phaseFilter === "all" || getCurrentPhase(p) === phaseFilter;
      return matchSearch && matchStatus && matchPhase;
    });
  }, [pdcas, search, statusFilter, phaseFilter]);

  const selectedPdca = pdcas.find(p => p.id === selectedPdcaId);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPhaseFilter("all");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Portfolio PDCA</h2>
          <p className="mt-1 text-sm text-slate-600">Gerenciamento completo do portfólio de PDCAs.</p>
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
            onClick={onImport}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Upload className="h-4 w-4" />
            Importar Excel
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-sky-100 p-2">
              <Layers className="h-4 w-4 text-sky-600" />
            </div>
            <span className="text-xs font-medium uppercase text-slate-500">PDCAs Ativos</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.ativo}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-100 p-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-xs font-medium uppercase text-slate-500">Concluídos</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.concluido}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-100 p-2">
              <Clock className="h-4 w-4 text-orange-600" />
            </div>
            <span className="text-xs font-medium uppercase text-slate-500">Em-andamento</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.emAndamento}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-rose-100 p-2">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            </div>
            <span className="text-xs font-medium uppercase text-slate-500">Atrasados</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.atrasado}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-100 p-2">
              <Gauge className="h-4 w-4 text-indigo-600" />
            </div>
            <span className="text-xs font-medium uppercase text-slate-500">Efetividade</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.efetividade}%</p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-purple-100 p-2">
              <Calendar className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-xs font-medium uppercase text-slate-500">Qtd-Ação</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900">{stats.prazoMedio}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar PDCA..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Todos os Status</option>
          <option value="concluido">Concluído</option>
          <option value="em-andamento">Em Andamento</option>
          <option value="planejado">Planejado</option>
          <option value="atrasado">Atrasado</option>
        </select>
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="rounded-lg border border-slate-200 py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Todas as Fases</option>
          <option value="PLAN">Plan</option>
          <option value="DO">Execute</option>
          <option value="CHECK">Check</option>
          <option value="ACT">Act</option>
        </select>
        <button
          onClick={clearFilters}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Limpar filtros
        </button>
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Table */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Código</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">PDCA</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Fase</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Progresso</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Responsável</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredPdcas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhum PDCA encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPdcas.map((pdca) => {
                    const progress = getPdcaProgress(pdca);
                    const status = getPdcaStatus(pdca);
                    const fase = getCurrentPhase(pdca);
                    const isSelected = pdca.id === selectedPdcaId;
                    return (
                      <tr
                        key={pdca.id}
                        onClick={() => onSelectPdca(pdca.id)}
                        className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50 ${isSelected ? "bg-blue-50" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-900">{pdca.id}</td>
                        <td className="px-4 py-3 text-slate-700">{pdca.titulo?.substring(0, 30) || "-"}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium text-white ${phaseColors[fase]}`}>
                            {phaseLabels[fase]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusConfig[status]?.className || "bg-slate-100 text-slate-600"}`}>
                            {statusConfig[status]?.label || status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
                              <div
                                className={`h-full rounded-full ${progress >= 90 ? "bg-emerald-500" : progress > 0 ? "bg-orange-500" : "bg-slate-300"}`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-600">{progress}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{pdca.area || "-"}</td>
                        <td className="px-4 py-3">
                          <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
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

        {/* Sidebar Panel */}
        <div className="space-y-4">
          {/* Detail Panel */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Detalhes do PDCA</h3>
            {selectedPdca ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Código</p>
                  <p className="mt-1 font-semibold text-slate-900">{selectedPdca.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Título</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedPdca.titulo}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Fase</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium text-white ${phaseColors[getCurrentPhase(selectedPdca)]}`}>
                      {phaseLabels[getCurrentPhase(selectedPdca)]}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Status</p>
                    <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusConfig[getPdcaStatus(selectedPdca)]?.className || "bg-slate-100 text-slate-600"}`}>
                      {statusConfig[getPdcaStatus(selectedPdca)]?.label || "Planejado"}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Progresso</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${getPdcaProgress(selectedPdca)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{getPdcaProgress(selectedPdca)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Área</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedPdca.area || "-"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-500">Situação</p>
                  <p className="mt-1 text-sm text-slate-700">{selectedPdca.situacao || "-"}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Selecione um PDCA na tabela.</p>
            )}
          </div>

          {/* Phase Distribution */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Distribuição por Fase</h3>
            <div className="mt-4 space-y-3">
              {phaseDistribution.map(({ phase, count, percent }) => (
                <div key={phase}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{phaseLabels[phase]}</span>
                    <span className="text-slate-500">{count} ({percent}%)</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${phaseColors[phase]}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Timeline de Prazos</h3>
            <div className="mt-4 space-y-2">
              {pdcas.slice(0, 5).map((pdca) => {
                const status = getPdcaStatus(pdca);
                const statusColor = status === "concluido" ? "bg-emerald-500" : status === "em-andamento" ? "bg-orange-500" : "bg-slate-300";
                return (
                  <div key={pdca.id} className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${statusColor}`} />
                    <span className="flex-1 text-sm text-slate-700">{pdca.id}</span>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}