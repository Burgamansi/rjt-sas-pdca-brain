"use client";

import { useState } from "react";
import { Database, CheckCircle, Clock, AlertTriangle, Layers3, ListChecks, FileText, User, Calendar, ArrowRight, RefreshCw, Search, Filter, ChevronDown } from "lucide-react";
import { PdcaRecord } from "@/lib/types";

const COLORS = {
  bg: "#0B1220",
  neon: "#00D4FF",
  neonSecondary: "#2563EB",
  neonGlow: "rgba(0, 212, 255, 0.25)",
  white: "#FFFFFF",
  gray: "#94A3B8",
  success: "#10B981",
  progress: "#F97316",
  error: "#EF4444",
  warning: "#FACC15"
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
    <div className="space-y-5" style={{ backgroundColor: COLORS.bg, minHeight: "100vh", padding: "24px" }}>
      {/* Header com Glow */}
      <div className="relative rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-6" style={{ boxShadow: `0_0_30px_${COLORS.neonGlow}` }}>
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 to-blue-500/5 pointer-events-none" />
        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: COLORS.neon, textShadow: `0_0_10px_${COLORS.neon}` }}>
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
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4 transition-all hover:border-cyan-500/40 hover:scale-[1.02]" style={{ boxShadow: "0_0_15px_rgba(0, 212, 255, 0.1)" }}>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4" style={{ color: COLORS.neon }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>PDCAs Ativos</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.white, textShadow: `0_0_10px_${COLORS.neon}` }}>{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 transition-all hover:border-emerald-500/40 hover:scale-[1.02]" style={{ boxShadow: "0_0_15px_rgba(16, 185, 129, 0.1)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" style={{ color: COLORS.success }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>Concluídas</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.success }}>{stats.concluidas}</p>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-950/10 p-4 transition-all hover:border-orange-500/40 hover:scale-[1.02]" style={{ boxShadow: "0_0_15px_rgba(249, 115, 22, 0.1)" }}>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: COLORS.progress }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>Em Andamento</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.progress }}>{stats.emAndamento}</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 p-4 transition-all hover:border-rose-500/40 hover:scale-[1.02]" style={{ boxShadow: "0_0_15px_rgba(239, 68, 68, 0.1)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: COLORS.error }} />
            <span className="text-xs font-medium uppercase" style={{ color: COLORS.gray }}>Atrasadas</span>
          </div>
          <p className="mt-2 text-2xl font-bold" style={{ color: COLORS.error }}>{stats.atrasadas}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: COLORS.neon }} />
          <input
            type="text"
            placeholder="Buscar PDCA..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-cyan-500/30 bg-cyan-950/30 py-2 pl-10 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-cyan-500 focus:outline-none"
            style={{ boxShadow: `0_0_10px_${COLORS.neonGlow}` }}
          />
        </div>
        <select
          value={selectedResponsible}
          onChange={(e) => setSelectedResponsible(e.target.value)}
          className="rounded-lg border border-cyan-500/30 bg-cyan-950/30 py-2 pl-3 pr-8 text-sm text-white focus:border-cyan-500 focus:outline-none"
        >
          <option value="all">Todos os Responsáveis</option>
          {responsaveis.map(resp => (
            <option key={resp} value={resp}>{resp}</option>
          ))}
        </select>
        <button
          onClick={() => { setSearchTerm(""); setSelectedResponsible("all"); }}
          className="flex items-center gap-2 rounded-lg border border-cyan-500/30 px-4 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-500/10"
        >
          <Filter className="h-4 w-4" />
          Limpar Filtros
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_350px]">
        {/* Main Table */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/10 overflow-hidden">
          <div className="border-b border-cyan-500/20 px-6 py-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold" style={{ color: COLORS.white }}>Base de Dados PDCAs</h3>
            <span className="text-sm" style={{ color: COLORS.gray }}>{filteredPdcas.length} registros</span>
          </div>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-cyan-950">
                <tr>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>PDCA</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Título</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Responsável</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Progresso</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: COLORS.neon }}>Status</th>
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
                      className="cursor-pointer border-b border-cyan-500/10 transition-colors hover:bg-cyan-500/10"
                      style={{ 
                        backgroundColor: isSelected ? "rgba(0, 212, 255, 0.1)" : "transparent",
                        borderLeft: isSelected ? `3px solid ${COLORS.neon}` : "3px solid transparent"
                      }}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: COLORS.neon }}>{pdca.id}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate" style={{ color: COLORS.white }}>{pdca.titulo}</td>
                      <td className="px-4 py-3" style={{ color: COLORS.gray }}>{pdca.area || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-cyan-950">
                            <div 
                              className="h-full rounded-full transition-all" 
                              style={{ 
                                width: `${progress}%`, 
                                backgroundColor: progress >= 90 ? COLORS.success : progress > 0 ? COLORS.progress : COLORS.gray,
                                boxShadow: `0_0_10px_${progress >= 90 ? COLORS.success : progress > 0 ? COLORS.progress : COLORS.gray}`
                              }} 
                            />
                          </div>
                          <span className="text-xs" style={{ color: COLORS.gray }}>{progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                          progress >= 90 ? "bg-emerald-500/20 text-emerald-400" :
                          progress > 0 ? "bg-orange-500/20 text-orange-400" :
                          "bg-cyan-500/20 text-cyan-400"
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
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-5">
            <h3 className="text-lg font-semibold mb-4" style={{ color: COLORS.white }}>Detalhes do PDCA</h3>
            {selectedPdca ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Código</p>
                  <p className="text-xl font-bold" style={{ color: COLORS.white, textShadow: `0_0_10px_${COLORS.neon}` }}>{selectedPdca.id}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Título</p>
                  <p className="text-sm" style={{ color: COLORS.white }}>{selectedPdca.titulo}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Responsável</p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-4 w-4" style={{ color: COLORS.gray }} />
                      <span className="text-sm" style={{ color: COLORS.white }}>{selectedPdca.area || "-"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Progresso</p>
                    <p className="text-lg font-bold" style={{ color: COLORS.neon }}>{selectedPdca.situacao || 0}%</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Status</p>
                  <span className="inline-flex mt-1 rounded-full px-3 py-1 text-sm font-medium bg-cyan-500/20 text-cyan-400">
                    {selectedPdca.status || "Pendente"}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase" style={{ color: COLORS.neon }}>Descrição</p>
                  <p className="text-sm mt-1" style={{ color: COLORS.gray }}>{selectedPdca.causas || "Nenhuma descrição disponível"}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8">
                <FileText className="h-12 w-12 mb-3" style={{ color: COLORS.gray }} />
                <p className="text-sm" style={{ color: COLORS.gray }}>Selecione um PDCA para ver detalhes</p>
              </div>
            )}
          </div>

          {/* Histórico Importação */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-5">
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