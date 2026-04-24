"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { PdcaPhase } from "@/lib/types";
import { PdcaGridRow } from "@/lib/pdca-front-mapper";

export type PdcaFilter = "all" | "done" | "progress" | "late" | "pending";

export type AppState = {
  selectedPdcaId: string;
  selectedPhase: PdcaPhase | "all";
  selectedFilter: PdcaFilter;
  selectedSubAction: PdcaGridRow | null;
  searchTerm: string;
  
  setSelectedPdcaId: (id: string) => void;
  setSelectedPhase: (phase: PdcaPhase | "all") => void;
  setSelectedFilter: (filter: PdcaFilter) => void;
  setSelectedSubAction: (subaction: PdcaGridRow | null) => void;
  setSearchTerm: (term: string) => void;
  
  clearFilters: () => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [selectedPdcaId, setSelectedPdcaId] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<PdcaPhase | "all">("all");
  const [selectedFilter, setSelectedFilter] = useState<PdcaFilter>("all");
  const [selectedSubAction, setSelectedSubAction] = useState<PdcaGridRow | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const clearFilters = () => {
    setSelectedPhase("all");
    setSelectedFilter("all");
    setSearchTerm("");
  };

  const value = useMemo<AppState>(() => ({
    selectedPdcaId,
    selectedPhase,
    selectedFilter,
    selectedSubAction,
    searchTerm,
    setSelectedPdcaId,
    setSelectedPhase,
    setSelectedFilter,
    setSelectedSubAction,
    setSearchTerm,
    clearFilters,
  }), [selectedPdcaId, selectedPhase, selectedFilter, selectedSubAction, searchTerm]);

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