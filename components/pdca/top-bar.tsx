"use client";

import { Menu, RefreshCcw, Search, Upload, X } from "lucide-react";
import { useAppState, PdcaFilter } from "@/lib/app-state";
import { PdcaPhase } from "@/lib/types";

type TopBarProps = {
  importing: boolean;
  loading: boolean;
  localMode: boolean;
  onRefresh: () => void;
  onOpenImport: () => void;
  onOpenSidebar: () => void;
};

const PHASE_LABEL: Record<PdcaPhase | "all", string> = {
  all: "Todos",
  plan: "PLAN",
  do: "DO",
  check: "CHECK",
  act: "ACT",
};

const FILTER_LABEL: Record<PdcaFilter, string> = {
  all: "Todos",
  done: "Concluído",
  progress: "Em Andamento",
  late: "Atrasado",
  pending: "Pendente",
};

export function TopBar({ importing, loading, localMode, onRefresh, onOpenImport, onOpenSidebar }: TopBarProps) {
  const {
    searchTerm,
    setSearchTerm,
    selectedPhase,
    setSelectedPhase,
    selectedFilter,
    setSelectedFilter,
    selectedActionId,
    setSelectedActionId,
    clearFilters,
  } = useAppState();

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (selectedPhase !== "all") {
    chips.push({ key: "phase", label: `Fase: ${PHASE_LABEL[selectedPhase]}`, clear: () => setSelectedPhase("all") });
  }
  if (selectedFilter !== "all") {
    chips.push({ key: "filter", label: FILTER_LABEL[selectedFilter], clear: () => setSelectedFilter("all") });
  }
  if (selectedActionId) {
    chips.push({ key: "action", label: `Ação: ${selectedActionId}`, clear: () => setSelectedActionId("") });
  }

  const hasActiveFilters = chips.length > 0 || !!searchTerm;

  return (
    <header className="space-y-2">
      <div className="rounded-2xl border border-[#1E7FD5]/15 bg-[#08192E]/85 px-4 py-3 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] backdrop-blur-sm">
        <div className="flex items-center gap-2">

          {/* Hamburger — só no mobile */}
          <button
            onClick={onOpenSidebar}
            className="lg:hidden flex-shrink-0 rounded-xl border border-[#1E7FD5]/20 bg-[#08192E]/60 p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Busca global */}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar subações, responsáveis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-[#1E7FD5]/20 bg-[#08192E]/60 py-2 pl-9 pr-9 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none focus:ring-1 focus:ring-cyan-500/30 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#82C4F8]/50 hover:text-[#82C4F8] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Botões de ação */}
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={loading}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-[#1E7FD5]/20 bg-[#08192E]/60 px-3 py-2 text-sm font-medium text-slate-300 transition-all hover:border-[#1E7FD5]/40 hover:bg-[#08192E] hover:text-white disabled:opacity-40"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
            <button
              onClick={onOpenImport}
              disabled={importing}
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#1E7FD5] to-[#0066B3] px-3 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(30,127,213,0.3)] transition-all hover:from-[#82C4F8] hover:to-[#1E7FD5] disabled:opacity-40"
            >
              <Upload className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{importing ? "Importando..." : "Importar"}</span>
            </button>
          </div>
        </div>

        {/* Chips de filtros ativos */}
        {hasActiveFilters && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">Filtros:</span>
            {searchTerm && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
                &ldquo;{searchTerm}&rdquo;
                <button onClick={() => setSearchTerm("")} className="ml-0.5 rounded-full hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-1 rounded-full border border-slate-600/50 bg-slate-700/40 px-2.5 py-0.5 text-xs font-medium text-slate-300"
              >
                {chip.label}
                <button onClick={chip.clear} className="ml-0.5 rounded-full hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="ml-1 text-[11px] text-slate-600 underline underline-offset-2 hover:text-slate-400 transition-colors"
            >
              Limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Modo local banner */}
      {localMode && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2 text-xs text-amber-300">
          ⚡ Modo local ativo — dados não são persistidos no Supabase. Importe um Excel para começar.
        </div>
      )}
    </header>
  );
}
