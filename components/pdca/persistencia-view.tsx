"use client";

import { useState } from "react";
import { Database, CheckCircle, Clock, AlertTriangle, Layers3, ListChecks, FileText, User, Calendar, ArrowRight, RefreshCw, Search, Filter, ChevronDown } from "lucide-react";
import { PdcaRecord } from "@/lib/types";
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

type PersistenciaViewProps = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  onRefresh: () => void;
  localMode: boolean;
};

export function PersistenciaView({ pdcas, selectedPdcaId, onSelectPdca, onRefresh, localMode }: PersistenciaViewProps) {
  const [selectedResponsible, setSelectedResponsible] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const responsaveis = Array.from(new Set(pdcas.map(p => p.area).filter(Boolean)));

  const filteredPdcas = pdcas.filter(pdca => {
    const matchesResponsavel = selectedResponsible === "all" || pdca.area === selectedResponsible;
    const matchesSearch = !searchTerm || 
      pdca.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pdca.titulo?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesResponsavel && matchesSearch;
  });

  const stats = {
    total: pdcas.length,
    concluidas: pdcas.filter(p => parseInt(p.situacao) >= 90).length,
    emAndamento: pdcas.filter(p => parseInt(p.situacao) > 0 && parseInt(p.situacao) < 90).length,
    atrasadas: 0
  };

  const selectedPdca = pdcas.find(p => p.id === selectedPdcaId);

  return (
    <div className="space-y-5" style={{ backgroundColor: COLORS.bg, padding: "16px" }}>
      {/* Header com Glow */}
      <div className="relative rounded-2xl border p-6" style={{ borderColor: T.borderL, backgroundColor: T.surface }}>
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: COLORS.neon }}>
              Persistência SGQ
            </h2>
            <p className="mt-2 text-sm" style={{ color: COLORS.gray }}>
              Base de dados auditável e rastreável
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium" style={{ color: COLORS.success }}>
                {localMode ? "Modo Local" : "Supabase Conectado"}
              </span>
            </div>
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all hover:scale-105"
              style={{ borderColor: COLORS.neon, color: COLORS.neon, backgroundColor: "transparent" }}
            >
              <RefreshCw className="h-4 w-4" />
              Sincronizar
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border p-4 transition-all hover:scale-[1.02]" style={{ borderColor: T.borderL, backgroundColor: T.surface }}>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" style={{ color: COLORS.neon }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>PDCAs Ativos</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.white }}>{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 p-4 transition-all hover:scale-[1.02]" style={{ backgroundColor: T.surface }}>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" style={{ color: COLORS.success }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>Concluídas</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.success }}>{stats.concluidas}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 p-4 transition-all hover:scale-[1.02]" style={{ backgroundColor: T.surface }}>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: COLORS.progress }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>Em Andamento</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.progress }}>{stats.emAndamento}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 p-4 transition-all hover:scale-[1.02]" style={{ backgroundColor: T.surface }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: COLORS.error }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>Atrasadas</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.error }}>{stats.atrasadas}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4" style={{ borderColor: T.border, backgroundColor: T.surface }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: COLORS.neon }} />
          <input
            type="text"
            placeholder="Buscar PDCA..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border py-2 pl-10 pr-4 text-sm focus:outline-none"
            style={{ borderColor: T.borderL, backgroundColor: T.surface2, color: T.text }}
          />
        </div>
        <select
          value={selectedResponsible}
          onChange={(e) => setSelectedResponsible(e.target.value)}
          className="rounded-lg border py-2 pl-3 pr-8 text-sm focus:outline-none"
          style={{ borderColor: T.borderL, backgroundColor: T.surface2, color: T.text }}
        >
          <option value="all">Todos os Responsáveis</option>
          {responsaveis.map(resp => (
            <option key={resp} value={resp}>{resp}</option>
          ))}
        </select>
        <button
          onClick={() => { setSearchTerm(""); setSelectedResponsible("all"); }}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
          style={{ borderColor: T.borderL, color: T.primary, backgroundColor: "transparent" }}
        >
          <Filter className="h-4 w-4" />
          Limpar Filtros
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_350px]">
        {/* Main Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: T.surface }}>
          <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: T.border }}>
            <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>Base de Dados PDCAs</h3>
            <span className="text-sm" style={{ color: COLORS.gray }}>{filteredPdcas.length} registros</span>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0" style={{ backgroundColor: T.surface2 }}>
                <tr>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: COLORS.neon }}>PDCA</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: COLORS.neon }}>Título</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: COLORS.neon }}>Responsável</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: COLORS.neon }}>Progresso</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: COLORS.neon }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPdcas.map((pdca) => {
                  const progress = parseInt(pdca.situacao) || 0;
                  const isSelected = pdca.id === selectedPdcaId;
                  return (
                    <tr
                      key={pdca.id}
                      onClick={() => onSelectPdca(pdca.id)}
                      className="cursor-pointer transition-colors"
                      style={{
                        borderBottom: `1px solid ${T.border}`,
                        backgroundColor: isSelected ? `${T.primary}18` : "transparent",
                        borderLeft: isSelected ? `3px solid ${COLORS.neon}` : "3px solid transparent"
                      }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: COLORS.neon }}>{pdca.id}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: COLORS.white }}>{pdca.titulo}</td>
                      <td className="px-4 py-3" style={{ color: COLORS.gray }}>{pdca.area || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 rounded-full" style={{ backgroundColor: T.surface2 }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${progress}%`,
                                backgroundColor: progress >= 90 ? COLORS.success : progress > 0 ? COLORS.progress : COLORS.gray
                              }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: COLORS.gray }}>{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          progress >= 90 ? "bg-emerald-500/15 text-emerald-400" :
                          progress > 0 ? "bg-amber-500/15 text-amber-400" :
                          "bg-blue-500/15 text-blue-400"
                        }`}>
                          {progress >= 90 ? "Concluído" : progress > 0 ? "Em Andamento" : "Pendente"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          <div className="rounded-xl border p-5" style={{ borderColor: T.border, backgroundColor: T.surface }}>
            <h3 className="text-base font-semibold mb-4" style={{ color: COLORS.white }}>Detalhes do PDCA</h3>
            {selectedPdca ? (() => {
              // Progress: count subactions, fall back to numeric situacao for demo data
              const allSubs = Object.values(selectedPdca.fases).flat().flatMap(a => a.subacoes);
              const total = allSubs.length;
              const concluded = allSubs.filter(s => s.status?.toLowerCase().includes("conclu")).length;
              const situacaoNum = parseInt(selectedPdca.situacao ?? "");
              const progress = total > 0
                ? Math.round((concluded / total) * 100)
                : (Number.isFinite(situacaoNum) ? situacaoNum : 0);
              // Description: situacao only if it's not a number/status keyword
              const isNumericOrStatus = /^\d+$/.test(selectedPdca.situacao ?? "") ||
                ["Pendente","Em Execução","Concluído","Importado"].some(k => (selectedPdca.situacao ?? "").startsWith(k));
              const descText = [
                !isNumericOrStatus ? selectedPdca.situacao : "",
                selectedPdca.causas,
              ].filter(Boolean).join("\n\n");

              return (
                <div className="space-y-4">
                  {/* Código + Título */}
                  <div className="flex items-start gap-3">
                    <div className="shrink-0">
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.neon }}>Código</p>
                      <p className="text-2xl font-bold font-mono" style={{ color: COLORS.neon }}>{selectedPdca.id}</p>
                    </div>
                    <div className="flex-1 min-w-0 border-l pl-3" style={{ borderColor: T.border }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.neon }}>Título</p>
                      <p className="text-sm leading-snug" style={{ color: COLORS.white }}>{selectedPdca.titulo || "-"}</p>
                    </div>
                  </div>

                  {/* Responsável + Status */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.neon }}>Responsável</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <User className="h-3.5 w-3.5 shrink-0" style={{ color: COLORS.gray }} />
                        <span className="text-xs truncate" style={{ color: COLORS.white }}>{selectedPdca.area || "-"}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.neon }}>Status</p>
                      <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-500/15 text-blue-300">
                        {selectedPdca.status || "Pendente"}
                      </span>
                    </div>
                  </div>

                  {/* Progresso */}
                  <div className="rounded-lg p-3" style={{ backgroundColor: T.bg }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: COLORS.neon }}>Progresso</p>
                      <span className="text-sm font-bold tabular-nums" style={{ color: COLORS.white }}>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "#1a2744" }}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1E7FD5] to-[#0066B3] transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-[10px] mt-1.5" style={{ color: COLORS.gray }}>
                      {concluded} de {total} subações concluídas
                    </p>
                  </div>

                  {/* Descrição / Contexto */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: COLORS.neon }}>
                      Descrição / Contexto
                    </p>
                    <div
                      className="rounded-lg p-3 max-h-36 overflow-y-auto text-xs leading-relaxed whitespace-pre-wrap"
                      style={{ backgroundColor: T.bg, color: COLORS.gray }}
                    >
                      {descText || "Nenhuma descrição disponível."}
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-12 w-12 mb-3" style={{ color: COLORS.gray }} />
                <p className="text-sm" style={{ color: COLORS.gray }}>Selecione um PDCA para ver detalhes</p>
              </div>
            )}
          </div>

          {/* Histórico Importação */}
          <div className="rounded-xl border p-5" style={{ borderColor: T.border, backgroundColor: T.surface }}>
            <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.white }}>Histórico de Importação</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.success }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: COLORS.white }}>PDCA-001 Importado</p>
                  <p className="text-xs" style={{ color: COLORS.gray }}>Há 2 dias • João Silva</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                <CheckCircle className="h-5 w-5 flex-shrink-0" style={{ color: COLORS.success }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: COLORS.white }}>PDCA-002 Importado</p>
                  <p className="text-xs" style={{ color: COLORS.gray }}>Há 5 dias • Maria Costa</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}