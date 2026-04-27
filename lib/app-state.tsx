"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { PdcaPhase, PdcaRecord } from "@/lib/types";
import { PdcaGridRow, mapPdcaToGridRows } from "@/lib/pdca-front-mapper";

export type PdcaFilter = "all" | "done" | "progress" | "late" | "pending";

export type PdcaView = "painel" | "portfolio" | "importacao" | "persistencia";

export type AppState = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  selectedPhase: PdcaPhase | "all";
  selectedFilter: PdcaFilter;
  selectedStatus: string;
  selectedResponsible: string;
  selectedActionId: string;
  selectedSubAction: PdcaGridRow | null;
  searchTerm: string;
  activeView: PdcaView;

  setPdcas: (pdcas: PdcaRecord[] | ((prev: PdcaRecord[]) => PdcaRecord[])) => void;
  setSelectedPdcaId: (id: string) => void;
  setSelectedPhase: (phase: PdcaPhase | "all") => void;
  setSelectedFilter: (filter: PdcaFilter) => void;
  setSelectedStatus: (status: string) => void;
  setSelectedResponsible: (resp: string) => void;
  setSelectedActionId: (id: string) => void;
  setSelectedSubAction: (subaction: PdcaGridRow | null) => void;
  setSearchTerm: (term: string) => void;
  setActiveView: (view: PdcaView) => void;

  clearFilters: () => void;

  getFilteredPdcas: () => PdcaRecord[];
  getFilteredSubactions: () => PdcaGridRow[];
};

const AppStateContext = createContext<AppState | null>(null);

const STATUS_FILTER_MAP: Record<string, string> = {
  done: "conclu",
  progress: "exec",
  late: "atras",
  pending: "pendente",
};

function safeIncludes(haystack: string, needle: string | undefined): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [pdcas, setPdcas] = useState<PdcaRecord[]>([]);
  const [selectedPdcaId, setSelectedPdcaId] = useState<string>("");
  const [selectedPhase, setSelectedPhase] = useState<PdcaPhase | "all">("all");
  const [selectedFilter, setSelectedFilter] = useState<PdcaFilter>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedResponsible, setSelectedResponsible] = useState<string>("all");
  const [selectedActionId, setSelectedActionId] = useState<string>("");
  const [selectedSubAction, setSelectedSubAction] = useState<PdcaGridRow | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeView, setActiveView] = useState<PdcaView>("painel");

  const clearFilters = () => {
    setSelectedPhase("all");
    setSelectedFilter("all");
    setSelectedStatus("all");
    setSelectedResponsible("all");
    setSelectedActionId("");
    setSearchTerm("");
  };

  const getFilteredPdcas = (): PdcaRecord[] => {
    let filtered = pdcas;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.id.toLowerCase().includes(term) ||
          (p.titulo ?? "").toLowerCase().includes(term) ||
          (p.area ?? "").toLowerCase().includes(term)
      );
    }

    if (selectedResponsible && selectedResponsible !== "all") {
      filtered = filtered.filter((p) => p.area === selectedResponsible);
    }

    if (selectedStatus && selectedStatus !== "all") {
      const needle = STATUS_FILTER_MAP[selectedStatus] ?? "";
      filtered = filtered.filter((p) => safeIncludes(p.status ?? "", needle));
    }

    return filtered;
  };

  const getFilteredSubactions = (): PdcaGridRow[] => {
    const filteredPdcas = getFilteredPdcas();
    const allRows: PdcaGridRow[] = filteredPdcas.flatMap((pdca) => mapPdcaToGridRows(pdca));

    let result = allRows;

    if (selectedPhase !== "all") {
      result = result.filter((r) => r.phase === selectedPhase);
    }

    if (selectedActionId) {
      result = result.filter((r) => r.acaoId === selectedActionId);
    }

    if (selectedFilter !== "all") {
      const needle = STATUS_FILTER_MAP[selectedFilter] ?? "";
      result = result.filter((r) => safeIncludes(r.status, needle));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          (r.subacao ?? "").toLowerCase().includes(term) ||
          (r.acao ?? "").toLowerCase().includes(term) ||
          (r.responsavel ?? "").toLowerCase().includes(term)
      );
    }

    return result;
  };

  const value = useMemo<AppState>(
    () => ({
      pdcas,
      selectedPdcaId,
      selectedPhase,
      selectedFilter,
      selectedStatus,
      selectedResponsible,
      selectedActionId,
      selectedSubAction,
      searchTerm,
      activeView,
      setPdcas,
      setSelectedPdcaId,
      setSelectedPhase,
      setSelectedFilter,
      setSelectedStatus,
      setSelectedResponsible,
      setSelectedActionId,
      setSelectedSubAction,
      setSearchTerm,
      setActiveView,
      clearFilters,
      getFilteredPdcas,
      getFilteredSubactions,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pdcas, selectedPdcaId, selectedPhase, selectedFilter, selectedStatus, selectedResponsible, selectedActionId, selectedSubAction, searchTerm, activeView]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
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
    const done = allSubactions.filter(
      (s) => safeIncludes(s.status, "conclu") || safeIncludes(s.status, "done")
    ).length;
    const inProgress = allSubactions.filter(
      (s) => safeIncludes(s.status, "exec") || safeIncludes(s.status, "andamento")
    ).length;
    const late = allSubactions.filter(
      (s) => safeIncludes(s.status, "atras") || safeIncludes(s.status, "critico")
    ).length;
    const pending = allSubactions.filter(
      (s) => safeIncludes(s.status, "pendente") || safeIncludes(s.status, "pending")
    ).length;
    const withEvidence = allSubactions.filter((s) => s.resultado && s.resultado !== "").length;

    const completion = total > 0 ? Math.round((done / total) * 100) : 0;

    // Regra: apenas PDCAs importados via arquivo Excel
    const excelPdcaCount = filteredPdcas.filter(
      (p) => p.fonteArquivo === "Excel Import"
    ).length;

    return {
      pdcaCount: filteredPdcas.length,
      excelPdcaCount,
      subactionCount: total,
      done,
      inProgress,
      late,
      pending,
      withEvidence,
      completion,
      pdcaProgressAverage: 0,
      critical: late,
    };
  }, [getFilteredSubactions, getFilteredPdcas]);

  return { stats, filteredPdcas: getFilteredPdcas(), filteredSubactions: getFilteredSubactions() };
}
