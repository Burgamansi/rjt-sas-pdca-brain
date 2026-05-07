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
    chip: "border-blue-400/40 bg-blue-500/15 text-blue-700",
    headerBg: "bg-blue-50 border-blue-200",
    actionBg: "bg-blue-50/60 hover:bg-blue-50",
    rowBg: "hover:bg-blue-50/40",
    border: "border-blue-200",
  },
  do: {
    label: "DO",
    bar: "bg-emerald-500",
    chip: "border-emerald-400/40 bg-emerald-500/15 text-emerald-700",
    headerBg: "bg-emerald-50 border-emerald-200",
    actionBg: "bg-emerald-50/60 hover:bg-emerald-50",
    rowBg: "hover:bg-emerald-50/40",
    border: "border-emerald-200",
  },
  check: {
    label: "CHECK",
    bar: "bg-amber-500",
    chip: "border-amber-400/40 bg-amber-500/15 text-amber-700",
    headerBg: "bg-amber-50 border-amber-200",
    actionBg: "bg-amber-50/60 hover:bg-amber-50",
    rowBg: "hover:bg-amber-50/40",
    border: "border-amber-200",
  },
  act: {
    label: "ACT",
    bar: "bg-rose-500",
    chip: "border-rose-400/40 bg-rose-500/15 text-rose-700",
    headerBg: "bg-rose-50 border-rose-200",
    actionBg: "bg-rose-50/60 hover:bg-rose-50",
    rowBg: "hover:bg-rose-50/40",
    border: "border-rose-200",
  },
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
  done:     "border-emerald-400/50 bg-emerald-500/15 text-emerald-700",
  late:     "border-rose-400/50 bg-rose-500/15 text-rose-700",
  progress: "border-amber-400/50 bg-amber-500/15 text-amber-700",
  pending:  "border-slate-300 bg-slate-100 text-slate-500",
};

const STATUS_LABEL = {
  done:     "Concluído",
  late:     "Atrasado",
  progress: "Em Andamento",
  pending:  "Pendente",
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-800">PDCA Brain — Grid Executivo</h3>
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              PDCA → AÇÃO PRINCIPAL → SUBAÇÃO
            </p>
          </div>
          <label className="text-xs font-medium text-slate-500">
            Selecionar PDCA
            <select
              className="mt-1 block min-w-56 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 focus:border-[#006AD7]/50 focus:outline-none"
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
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {(["plan", "do", "check", "act"] as PdcaPhase[]).map((phase) => {
            const s = PHASE_STYLE[phase];
            const active = selectedPhase === phase;
            return (
              <button
                key={phase}
                onClick={() => setSelectedPhase(active ? "all" : phase)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-semibold transition-all ${s.chip} ${active ? "ring-2 ring-[#006AD7]/30 scale-105" : "opacity-70 hover:opacity-100"}`}
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
                ? "border-[#006AD7]/40 bg-[#006AD7]/10 text-[#006AD7] ring-2 ring-[#006AD7]/20"
                : "border-slate-200 bg-white text-slate-500 hover:text-slate-800"
            }`}
          >
            Todos
          </button>
          {selectedActionId && (
            <button
              onClick={() => setSelectedActionId("")}
              className="inline-flex items-center gap-1 rounded-full border border-[#006AD7]/30 bg-[#006AD7]/8 px-3 py-1 text-xs font-medium text-[#006AD7] hover:bg-[#006AD7]/15"
            >
              ✕ Limpar filtro ação
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        {/* Estados vazios */}
        {loading && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Carregando dados...
          </p>
        )}
        {!loading && !pdcas.length && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            {localMode ? "Sem PDCAs carregados nesta sessão local." : "Ainda sem PDCAs sincronizados no Supabase."}
          </p>
        )}

        {/* Grid Hierárquico */}
        {!loading && hierarchy.length > 0 && (
          <div className="space-y-4">
            {hierarchy.map(({ phase, actions }) => {
              const ps = PHASE_STYLE[phase];
              return (
                <div key={phase} className={`overflow-hidden rounded-xl border ${ps.border} bg-white`}>
                  {/* Header da fase */}
                  <div className={`flex items-center gap-3 px-4 py-2.5 border-b ${ps.headerBg}`}>
                    <span className={`h-5 w-1.5 rounded-full ${ps.bar}`} />
                    <span className="text-sm font-bold text-slate-700 tracking-widest">{ps.label}</span>
                    <span className="text-xs text-slate-500">{actions.reduce((a, g) => a + g.rows.length, 0)} subações</span>
                  </div>

                  {/* Ações */}
                  <div className="divide-y divide-slate-100">
                    {actions.map(({ action, rows: subRows }) => {
                      const actionKey = `${phase}-${action.id}`;
                      const collapsed = collapsedActions.has(actionKey);
                      const isFiltered = selectedActionId === action.id;
                      const doneCount = subRows.filter((r) => statusKind(r.status, r.prazo) === "done").length;

                      return (
                        <div key={actionKey}>
                          {/* Linha de ação */}
                          <div
                            className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${ps.actionBg} ${isFiltered ? "ring-1 ring-inset ring-[#006AD7]/20" : ""}`}
                            onClick={() => toggleAction(actionKey)}
                          >
                            <button
                              className="text-slate-400 hover:text-slate-700 flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); toggleAction(actionKey); }}
                            >
                              {collapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </button>
                            <span
                              className="flex-1 text-sm font-semibold text-slate-700 hover:text-[#006AD7] transition-colors"
                              onClick={(e) => { e.stopPropagation(); handleClickAction(action.id); }}
                            >
                              {action.id} — {action.acao}
                            </span>
                            <span className="text-xs text-slate-400 flex-shrink-0">
                              {doneCount}/{subRows.length}
                            </span>
                            <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden flex-shrink-0">
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
                                  <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="pl-10 pr-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subação</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Como Fazer</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Responsável</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Prazo</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Evidência SGQ</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                    <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Ver</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {subRows.map((row, idx) => {
                                    const kind = statusKind(row.status, row.prazo);
                                    return (
                                      <tr
                                        key={`${row.subacaoId}-${idx}`}
                                        className={`${ps.rowBg} transition-colors`}
                                      >
                                        <td
                                          className="pl-10 pr-3 py-2.5 font-medium text-slate-800 cursor-pointer hover:text-[#006AD7] transition-colors max-w-[240px]"
                                          onClick={() => onSelectSubAction?.(row)}
                                        >
                                          <span className="line-clamp-2">{row.subacao || "—"}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-600 max-w-[200px]">
                                          <span className="line-clamp-2 text-xs">{row.comoFazer || "—"}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap text-xs font-medium">
                                          {row.responsavel || "—"}
                                        </td>
                                        <td className={`px-3 py-2.5 whitespace-nowrap text-xs font-medium ${kind === "late" ? "text-rose-600" : "text-slate-600"}`}>
                                          {row.prazo || "—"}
                                        </td>
                                        <td className="px-3 py-2.5 text-slate-500 max-w-[180px]">
                                          <span className="line-clamp-1 text-xs">{row.evidenciaSgq || "—"}</span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLE[kind]}`}>
                                            {STATUS_LABEL[kind]}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          <button
                                            className="inline-flex items-center justify-center rounded-lg border border-[#006AD7]/25 bg-[#006AD7]/8 p-1.5 text-[#006AD7] hover:bg-[#006AD7]/15 transition-colors"
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
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Nenhuma subação para exibir com os filtros atuais.
          </p>
        )}
      </div>
    </section>
  );
}
