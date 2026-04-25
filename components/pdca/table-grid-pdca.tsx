"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { PdcaPhase, PdcaRecord } from "@/lib/types";
import { PdcaAction } from "@/lib/types";
import { PdcaGridRow, mapPdcaToGridRows } from "@/lib/pdca-front-mapper";
import { useAppState } from "@/lib/app-state";

type TableGridPDCAProps = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  loading: boolean;
  localMode: boolean;
  onSelectSubAction?: (subaction: PdcaGridRow) => void;
};

const PHASE_STYLE: Record<PdcaPhase, {
  label: string;
  bar: string;
  chip: string;
  headerBg: string;
  actionBg: string;
  rowBg: string;
  border: string;
}> = {
  plan: {
    label: "PLAN",
    bar: "bg-blue-500",
    chip: "border-blue-500/50 bg-blue-500/15 text-blue-200",
    headerBg: "bg-slate-950/80 border-blue-500/30",
    actionBg: "bg-blue-500/8 hover:bg-blue-500/15",
    rowBg: "hover:bg-blue-500/5",
    border: "border-blue-500/20",
  },
  do: {
    label: "DO",
    bar: "bg-emerald-500",
    chip: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300",
    headerBg: "bg-emerald-900/40 border-emerald-500/30",
    actionBg: "bg-emerald-900/20 hover:bg-emerald-900/35",
    rowBg: "hover:bg-emerald-500/5",
    border: "border-emerald-500/20",
  },
  check: {
    label: "CHECK",
    bar: "bg-amber-500",
    chip: "border-amber-400/50 bg-amber-500/15 text-amber-300",
    headerBg: "bg-amber-900/40 border-amber-500/30",
    actionBg: "bg-amber-900/20 hover:bg-amber-900/35",
    rowBg: "hover:bg-amber-500/5",
    border: "border-amber-500/20",
  },
  act: {
    label: "ACT",
    bar: "bg-rose-500",
    chip: "border-rose-400/50 bg-rose-500/15 text-rose-300",
    headerBg: "bg-rose-900/40 border-rose-500/30",
    actionBg: "bg-rose-900/20 hover:bg-rose-900/35",
    rowBg: "hover:bg-rose-500/5",
    border: "border-rose-500/20",
  },
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function parsePrazo(value: string): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const brDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (brDate) {
    const day = Number(brDate[1]);
    const month = Number(brDate[2]) - 1;
    const yearRaw = Number(brDate[3]);
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw;
    const parsed = new Date(year, month, day, 23, 59, 59);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const iso = new Date(raw);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

function statusKind(status: string, prazo: string): "done" | "late" | "progress" | "pending" {
  const norm = normalizeText(status);
  if (norm.includes("conclu") || norm.includes("done")) return "done";
  if (norm.includes("atras")) return "late";
  const deadline = parsePrazo(prazo);
  if (deadline && deadline.getTime() < Date.now()) return "late";
  if (norm.includes("exec") || norm.includes("aberto") || norm.includes("aguard") || norm.includes("andamento")) return "progress";
  return "pending";
}

const STATUS_STYLE = {
  done: "border-emerald-400/50 bg-emerald-500/15 text-emerald-300",
  late: "border-rose-400/50 bg-rose-500/15 text-rose-300",
  progress: "border-amber-400/50 bg-amber-500/15 text-amber-300",
  pending: "border-slate-500/50 bg-slate-700/30 text-slate-400",
};

const STATUS_LABEL = {
  done: "Concluído",
  late: "Atrasado",
  progress: "Em Andamento",
  pending: "Pendente",
};

type ActionGroup = {
  action: PdcaAction;
  phase: PdcaPhase;
  rows: PdcaGridRow[];
};

type PhaseGroup = {
  phase: PdcaPhase;
  actions: ActionGroup[];
};

function buildHierarchy(pdca: PdcaRecord, rows: PdcaGridRow[]): PhaseGroup[] {
  const phases: PdcaPhase[] = ["plan", "do", "check", "act"];
  const result: PhaseGroup[] = [];

  for (const phase of phases) {
    const actions = pdca.fases[phase] ?? [];
    if (!actions.length) continue;

    const actionGroups: ActionGroup[] = [];
    for (const action of actions) {
      const actionRows = rows.filter((r) => r.phase === phase && r.acaoId === action.id);
      if (actionRows.length) {
        actionGroups.push({ action, phase, rows: actionRows });
      }
    }

    if (actionGroups.length) {
      result.push({ phase, actions: actionGroups });
    }
  }

  return result;
}

function selectedPdca(pdcas: PdcaRecord[], id: string): PdcaRecord | null {
  if (!pdcas.length) return null;
  return pdcas.find((p) => p.id === id) ?? pdcas[0];
}

export function TableGridPDCA({
  pdcas,
  selectedPdcaId,
  onSelectPdca,
  loading,
  localMode,
  onSelectSubAction,
}: TableGridPDCAProps) {
  const { selectedFilter, selectedPhase, setSelectedPhase, setSelectedActionId, selectedActionId, searchTerm } = useAppState();
  const [collapsedActions, setCollapsedActions] = useState<Set<string>>(new Set());

  const current = selectedPdca(pdcas, selectedPdcaId);

  let rows = current ? mapPdcaToGridRows(current) : [];

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.subacao ?? "").toLowerCase().includes(term) ||
        (r.acao ?? "").toLowerCase().includes(term) ||
        (r.responsavel ?? "").toLowerCase().includes(term)
    );
  }
  if (selectedPhase !== "all") {
    rows = rows.filter((r) => r.phase === selectedPhase);
  }
  if (selectedFilter !== "all") {
    const map: Record<string, string> = { done: "conclu", progress: "exec", late: "atras", pending: "pendente" };
    const needle = map[selectedFilter] ?? "";
    rows = rows.filter((r) => (r.status ?? "").toLowerCase().includes(needle));
  }
  if (selectedActionId) {
    rows = rows.filter((r) => r.acaoId === selectedActionId);
  }

  const hierarchy = current ? buildHierarchy(current, rows) : [];

  function toggleAction(actionKey: string) {
    setCollapsedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionKey)) {
        next.delete(actionKey);
      } else {
        next.add(actionKey);
      }
      return next;
    });
  }

  function handleClickAction(acaoId: string) {
    setSelectedActionId(selectedActionId === acaoId ? "" : acaoId);
  }

  return (
    <section className="rounded-3xl border border-blue-500/15 bg-slate-950/60 p-5 shadow-[0_28px_55px_-35px_rgba(15,23,42,0.9)]">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">PDCA Brain — Grid Executivo</h3>
          <p className="mt-1 text-xs text-slate-400 font-medium tracking-wide uppercase">
            PDCA → AÇÃO PRINCIPAL → SUBAÇÃO
          </p>
        </div>
        <label className="text-sm font-medium text-slate-300">
          Selecionar PDCA
          <select
            className="mt-1 block min-w-56 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-white focus:border-cyan-400 focus:outline-none"
            value={current?.id ?? ""}
            onChange={(e) => onSelectPdca(e.target.value)}
            disabled={!pdcas.length}
          >
            {pdcas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Filtros de fase */}
      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(["plan", "do", "check", "act"] as PdcaPhase[]).map((phase) => {
          const s = PHASE_STYLE[phase];
          const active = selectedPhase === phase;
          return (
            <button
              key={phase}
              onClick={() => setSelectedPhase(active ? "all" : phase)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-all ${s.chip} ${active ? "ring-2 ring-white/40 scale-105" : "opacity-70 hover:opacity-100"}`}
            >
              <span className={`h-2 w-2 rounded-full ${s.bar}`} />
              {s.label}
            </button>
          );
        })}
        <button
          onClick={() => { setSelectedPhase("all"); setSelectedActionId(""); }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-all ${
            selectedPhase === "all" && !selectedActionId
              ? "border-cyan-400/60 bg-cyan-500/15 text-blue-200 ring-2 ring-cyan-400/30"
              : "border-slate-600 bg-slate-800 text-slate-400 hover:text-white"
          }`}
        >
          Todos
        </button>
        {selectedActionId && (
          <button
            onClick={() => setSelectedActionId("")}
            className="inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200 hover:bg-cyan-500/20"
          >
            ✕ Limpar filtro ação
          </button>
        )}
      </div>

      {/* Estados vazios */}
      {loading && (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-400">
          Carregando dados...
        </p>
      )}
      {!loading && !pdcas.length && (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-400">
          {localMode ? "Sem PDCAs carregados nesta sessão local." : "Ainda sem PDCAs sincronizados no Supabase."}
        </p>
      )}

      {/* Grid Hierárquico */}
      {!loading && hierarchy.length > 0 && (
        <div className="space-y-5">
          {hierarchy.map(({ phase, actions }) => {
            const ps = PHASE_STYLE[phase];
            return (
              <div key={phase} className={`overflow-hidden rounded-2xl border ${ps.border} bg-slate-950/40`}>
                {/* Header da fase */}
                <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${ps.headerBg}`}>
                  <span className={`h-5 w-1.5 rounded-full ${ps.bar}`} />
                  <span className="text-sm font-bold text-white tracking-widest">{ps.label}</span>
                  <span className="text-xs text-slate-400">{actions.reduce((a, g) => a + g.rows.length, 0)} subações</span>
                </div>

                {/* Ações */}
                <div className="divide-y divide-slate-800/60">
                  {actions.map(({ action, rows: subRows }) => {
                    const actionKey = `${phase}-${action.id}`;
                    const collapsed = collapsedActions.has(actionKey);
                    const isFiltered = selectedActionId === action.id;
                    const doneCount = subRows.filter((r) => statusKind(r.status, r.prazo) === "done").length;

                    return (
                      <div key={actionKey}>
                        {/* Linha de ação */}
                        <div
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${ps.actionBg} ${isFiltered ? "ring-1 ring-inset ring-cyan-400/30" : ""}`}
                          onClick={() => toggleAction(actionKey)}
                        >
                          <button
                            className="text-slate-400 hover:text-white flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); toggleAction(actionKey); }}
                          >
                            {collapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </button>
                          <span
                            className={`flex-1 text-sm font-semibold text-white hover:text-blue-200 transition-colors`}
                            onClick={(e) => { e.stopPropagation(); handleClickAction(action.id); }}
                          >
                            {action.id} — {action.acao}
                          </span>
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {doneCount}/{subRows.length}
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-slate-700 overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${ps.bar}`}
                              style={{ width: `${subRows.length ? (doneCount / subRows.length) * 100 : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Subações */}
                        {!collapsed && (
                          <div className="overflow-x-auto">
                            <table className="min-w-[900px] w-full text-sm">
                              <thead>
                                <tr className="bg-slate-950/80 border-b border-blue-500/15">
                                  <th className="pl-10 pr-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Subação</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Como Fazer</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Responsável</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Prazo</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Evidência SGQ</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide">Ver</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/40">
                                {subRows.map((row, idx) => {
                                  const kind = statusKind(row.status, row.prazo);
                                  return (
                                    <tr
                                      key={`${row.subacaoId}-${idx}`}
                                      className={`${ps.rowBg} transition-colors`}
                                    >
                                      <td
                                        className="pl-10 pr-3 py-2.5 font-medium text-white cursor-pointer hover:text-blue-200 transition-colors max-w-[240px]"
                                        onClick={() => onSelectSubAction?.(row)}
                                      >
                                        <span className="line-clamp-2">{row.subacao || "—"}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-300 max-w-[200px]">
                                        <span className="line-clamp-2 text-xs">{row.comoFazer || "—"}</span>
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-200 whitespace-nowrap text-xs font-medium">
                                        {row.responsavel || "—"}
                                      </td>
                                      <td className={`px-3 py-2.5 whitespace-nowrap text-xs font-medium ${kind === "late" ? "text-rose-400" : "text-slate-300"}`}>
                                        {row.prazo || "—"}
                                      </td>
                                      <td className="px-3 py-2.5 text-slate-400 max-w-[180px]">
                                        <span className="line-clamp-1 text-xs">{row.evidenciaSgq || "—"}</span>
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[kind]}`}>
                                          {STATUS_LABEL[kind]}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-center">
                                        <button
                                          className="inline-flex items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/10 p-1.5 text-blue-400 hover:bg-cyan-500/20 transition-colors"
                                          onClick={() => onSelectSubAction?.(row)}
                                          title="Ver detalhes"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && current && !hierarchy.length && (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-400">
          Nenhuma subação para exibir com os filtros atuais.
        </p>
      )}
    </section>
  );
}
