"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { PdcaPhase, PdcaRecord } from "@/lib/types";
import { PdcaGridRow } from "@/lib/pdca-front-mapper";

export type PdcaFilter = "all" | "done" | "progress" | "late" | "pending";

export type PdcaView = "painel" | "portfolio" | "importacao" | "persistencia";

export type AppState = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  selectedPhase: PdcaPhase | "all";
  selectedFilter: PdcaFilter;
  selectedStatus: string;
  selectedResponsible: string;
  selectedSubAction: PdcaGridRow | null;
  searchTerm: string;
  activeView: PdcaView;
  
  setPdcas: (pdcas: PdcaRecord[] | ((prev: PdcaRecord[]) => PdcaRecord[])) => void;
  setSelectedPdcaId: (id: string) => void;
  setSelectedPhase: (phase: PdcaPhase | "all") => void;
  setSelectedFilter: (filter: PdcaFilter) => void;
  setSelectedStatus: (status: string) => void;
  setSelectedResponsible: (resp: string) => void;
  setSelectedSubAction: (subaction: PdcaGridRow | null) => void;
  setSearchTerm: (term: string) => void;
  setActiveView: (view: PdcaView) => void;
  
  clearFilters: () => void;
  
  getFilteredPdcas: () => PdcaRecord[];
  getFilteredSubactions: () => PdcaGridRow[];
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [pdcas, setPdcas] = useState<PdcaRecord[]>([]);
  const [selectedPdcaId, setSelectedPdcaId] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<PdcaPhase | "all">("all");
  const [selectedFilter, setSelectedFilter] = useState<PdcaFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("all");
  const [selectedSubAction, setSelectedSubAction] = useState<PdcaGridRow | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeView, setActiveView] = useState<PdcaView>("painel");

  const clearFilters = () => {
    setSelectedPhase("all");
    setSelectedFilter("all");
    setSelectedStatus("all");
    setSelectedResponsible("all");
    setSearchTerm("");
  };

  const getFilteredPdcas = (): PdcaRecord[] => {
    let filtered = pdcas;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.id.toLowerCase().includes(term) || 
        p.titulo?.toLowerCase().includes(term) ||
        p.area?.toLowerCase().includes(term)
      );
    }
    
    if (selectedResponsible && selectedResponsible !== "all") {
      filtered = filtered.filter(p => p.area === selectedResponsible);
    }
    
    if (selectedStatus && selectedStatus !== "all") {
      const statusMap: Record<string, string[]> = {
        done: ["conclu", "done"],
        progress: ["exec", "andamento", "progress"],
        late: ["atras", "late", "critico"],
        pending: ["pendente", "pending"]
      };
      filtered = filtered.filter(p => 
        p.status?.toLowerCase().includes(statusMap[selectedStatus]?.[0] || "")
      );
    }
    
    return filtered;
  };

  const getFilteredSubactions = (): PdcaGridRow[] => {
    const filteredPdcas = getFilteredPdcas();
    const allRows: PdcaGridRow[] = [];
    
    for (const pdca of filteredPdcas) {
      const fases: PdcaPhase[] = ["plan", "do", "check", "act"];
      for (const fase of fases) {
        const actions = pdca.fases[fase] || [];
        for (const action of actions) {
          const subacoes = action.subacoes || [];
          for (const sub of subacoes) {
            allRows.push({
              phase: fase,
              etapa: action.etapa,
              acao: action.acao,
              subacao: sub.nome,
              responsavel: sub.resp,
              resultado: sub.resultado,
              status: sub.status,
              prazo: (sub as any).prazo || ""
            });
          }
        }
      }
    }
    
    let result = allRows;
    
    if (selectedPhase && selectedPhase !== "all") {
      result = result.filter(r => r.phase === selectedPhase);
    }
    
    if (selectedFilter && selectedFilter !== "all") {
      const statusMap: Record<string, string> = {
        done: "conclu",
        progress: "exec",
        late: "atras",
        pending: "pendente"
      };
      result = result.filter(r => 
        r.status.toLowerCase().includes(statusMap[selectedFilter])
      );
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(r =>
        r.subacao.toLowerCase().includes(term) ||
        r.acao.toLowerCase().includes(term) ||
        r.responsavel.toLowerCase().includes(term)
      );
    }
    
    return result;
  };

  const value = useMemo<AppState>(() => ({
    pdcas,
    selectedPdcaId,
    selectedPhase,
    selectedFilter,
    selectedStatus,
    selectedResponsible,
    selectedSubAction,
    searchTerm,
    activeView,
    setPdcas,
    setSelectedPdcaId,
    setSelectedPhase,
    setSelectedFilter,
    setSelectedStatus,
    setSelectedResponsible,
    setSelectedSubAction,
    setSearchTerm,
    setActiveView,
    clearFilters,
    getFilteredPdcas,
    getFilteredSubactions,
  }), [pdcas, selectedPdcaId, selectedPhase, selectedFilter, selectedStatus, selectedResponsible, selectedSubAction, searchTerm, activeView]);

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppState {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return context;
}

export function useFilteredData() {
  const { getFilteredPdcas, getFilteredSubactions } = useAppState();
  
  const stats = useMemo(() => {
    const allSubactions = getFilteredSubactions();
    const filteredPdcas = getFilteredPdcas();
    
    const total = allSubactions.length;
    const done = allSubactions.filter(s => 
      s.status.toLowerCase().includes("conclu") || s.status.toLowerCase().includes("done")
    ).length;
    const inProgress = allSubactions.filter(s => 
      s.status.toLowerCase().includes("exec") || s.status.toLowerCase().includes("andamento")
    ).length;
    const late = allSubactions.filter(s => 
      s.status.toLowerCase().includes("atras") || s.status.toLowerCase().includes("critico")
    ).length;
    const pending = allSubactions.filter(s => 
      s.status.toLowerCase().includes("pendente") || s.status.toLowerCase().includes("pending")
    ).length;
    const withEvidence = allSubactions.filter(s => s.resultado && s.resultado !== "").length;
    
    const completion = total > 0 ? Math.round((done / total) * 100) : 0;
    const pdcaProgressAverage = filteredPdcas.length > 0 
      ? Math.round(filteredPdcas.reduce((acc, p) => acc + (parseInt(p.situacao) || 0), 0) / filteredPdcas.length)
      : 0;
    
    return {
      pdcaCount: filteredPdcas.length,
      subactionCount: total,
      done,
      inProgress,
      late,
      pending,
      withEvidence,
      completion,
      pdcaProgressAverage,
      critical: late
    };
  }, [getFilteredSubactions, getFilteredPdcas]);
  
  return { stats, filteredPdcas: getFilteredPdcas(), filteredSubactions: getFilteredSubactions() };
}