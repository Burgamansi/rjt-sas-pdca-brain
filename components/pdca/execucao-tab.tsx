"use client";

import { useState, useMemo } from "react";
import { X, FileText, Layers3, ChevronRight } from "lucide-react";
import { PdcaRecord, PdcaPhase } from "@/lib/types";
import { PdcaGridRow, mapPdcaToGridRows } from "@/lib/pdca-front-mapper";

type ExecucaoTabProps = {
  pdcas: PdcaRecord[];
};

type DrawerTab = "como" | "insumos" | "obs" | "evidencias";

type PdcaGridRowWithPdca = PdcaGridRow & { pdcaId: string; pdcaTitulo: string };

function statusConfig(status: string) {
  const s = status.toLowerCase();
  if (s.includes("conclu"))
    return { dot: "bg-emerald-500", label: "Concluído", text: "text-emerald-400", badge: "bg-emerald-500/15 border-emerald-500/30" };
  if (s.includes("exec") || s.includes("andamento"))
    return { dot: "bg-amber-400", label: "Em Execução", text: "text-amber-400", badge: "bg-amber-500/15 border-amber-500/30" };
  if (s.includes("atras"))
    return { dot: "bg-rose-500", label: "Atrasado", text: "text-rose-400", badge: "bg-rose-500/15 border-rose-500/30" };
  if (s.includes("aguard"))
    return { dot: "bg-sky-400", label: "Aguardando", text: "text-sky-400", badge: "bg-sky-500/15 border-sky-500/30" };
  return { dot: "bg-slate-500", label: "Pendente", text: "text-slate-400", badge: "bg-slate-600/20 border-slate-600/30" };
}

const PHASE_CONFIG: Record<PdcaPhase, { label: string; color: string; badge: string }> = {
  plan:  { label: "PLAN",  color: "text-blue-400",    badge: "bg-blue-500/15 border-blue-500/30" },
  do:    { label: "DO",    color: "text-emerald-400", badge: "bg-emerald-500/15 border-emerald-500/30" },
  check: { label: "CHECK", color: "text-amber-400",   badge: "bg-amber-500/15 border-amber-500/30" },
  act:   { label: "ACT",   color: "text-rose-400",    badge: "bg-rose-500/15 border-rose-500/30" },
};

const STATUS_FILTERS = [
  { key: "all",      label: "Todos" },
  { key: "conclu",   label: "Concluído" },
  { key: "exec",     label: "Em Execução" },
  { key: "atras",    label: "Atrasado" },
  { key: "pendente", label: "Pendente" },
];

export function ExecucaoTab({ pdcas }: ExecucaoTabProps) {
  const [phaseFilter, setPhaseFilter] = useState<PdcaPhase | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedRow, setSelectedRow] = useState<PdcaGridRowWithPdca | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("como");

  const allRows = useMemo<PdcaGridRowWithPdca[]>(
    () =>
      pdcas.flatMap((p) =>
        mapPdcaToGridRows(p).map((r) => ({ ...r, pdcaId: p.id, pdcaTitulo: p.titulo ?? p.id }))
      ),
    [pdcas]
  );

  const filtered = useMemo(() => {
    let rows = allRows;
    if (phaseFilter !== "all") rows = rows.filter((r) => r.phase === phaseFilter);
    if (statusFilter !== "all") rows = rows.filter((r) => r.status.toLowerCase().includes(statusFilter));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.subacao?.toLowerCase().includes(q) ||
          r.acao?.toLowerCase().includes(q) ||
          r.responsavel?.toLowerCase().includes(q) ||
          r.subacaoId?.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [allRows, phaseFilter, statusFilter, search]);

  const total = allRows.length;
  const done = allRows.filter((r) => r.status.toLowerCase().includes("conclu")).length;
  const inProgress = allRows.filter(
    (r) => r.status.toLowerCase().includes("exec") || r.status.toLowerCase().includes("andamento")
  ).length;
  const late = allRows.filter((r) => r.status.toLowerCase().includes("atras")).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function handleRowClick(row: PdcaGridRowWithPdca) {
    const isSame = selectedRow?.subacaoId === row.subacaoId && selectedRow?.pdcaId === row.pdcaId;
    setSelectedRow(isSame ? null : row);
    setDrawerTab("como");
  }

  return (
    <div className="flex gap-4 min-h-0">
      {/* ── LEFT: main grid ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">

        {/* KPI row */}
        <div className="grid grid-cols-5 gap-3">
          {([
            { label: "Total Tarefas",  value: total,    grad: "from-[#1E7FD5] to-[#1565C0]" },
            { label: "Concluídas",     value: done,     grad: "from-emerald-600 to-teal-700" },
            { label: "Em Execução",    value: inProgress, grad: "from-amber-500 to-orange-600" },
            { label: "Atrasadas",      value: late,     grad: "from-rose-600 to-red-700" },
            { label: "Efetividade",    value: `${pct}%`, grad: pct >= 70 ? "from-emerald-600 to-teal-700" : pct >= 40 ? "from-amber-500 to-orange-600" : "from-rose-600 to-red-700" },
          ] as const).map((kpi) => (
            <div key={kpi.label} className={`rounded-xl bg-gradient-to-br ${kpi.grad} px-4 py-3 shadow-lg`}>
              <div className="text-2xl font-bold text-white tracking-tight">{kpi.value}</div>
              <div className="mt-0.5 text-xs text-white/65">{kpi.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["all", "plan", "do", "check", "act"] as const).map((ph) => (
              <button
                key={ph}
                onClick={() => setPhaseFilter(ph)}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                  phaseFilter === ph
                    ? "bg-[#1E7FD5] text-white shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {ph === "all" ? "TODOS" : ph.toUpperCase()}
              </button>
            ))}
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-[#0E2539] px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#1E7FD5]/50"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefa, ação, responsável..."
            className="flex-1 min-w-44 rounded-lg border border-white/10 bg-[#0E2539] px-3 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 focus:outline-none focus:border-[#1E7FD5]/40"
          />

          <span className="text-xs text-slate-600 shrink-0">
            {filtered.length}/{total} tarefa{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Grid */}
        {pdcas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 text-slate-600">
            <Layers3 className="mb-3 h-10 w-10 opacity-20" />
            <p className="text-sm">Nenhum PDCA carregado.</p>
            <p className="mt-1 text-xs">Importe uma planilha na aba SETUP EXCEL.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04]">
                    {["ID", "PDCA", "FASE", "AÇÃO", "TAREFA", "RESPONSÁVEL", "PRAZO", "STATUS", ""].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, idx) => {
                    const sc = statusConfig(row.status);
                    const pc = PHASE_CONFIG[row.phase] ?? PHASE_CONFIG.plan;
                    const isSelected =
                      selectedRow?.subacaoId === row.subacaoId && selectedRow?.pdcaId === row.pdcaId;
                    return (
                      <tr
                        key={`${row.pdcaId}-${row.acaoId}-${row.subacaoId}-${idx}`}
                        onClick={() => handleRowClick(row)}
                        className={`cursor-pointer border-b border-white/[0.04] transition-colors ${
                          isSelected
                            ? "bg-[#1E7FD5]/12"
                            : idx % 2 === 0
                            ? "hover:bg-white/[0.025]"
                            : "bg-white/[0.02] hover:bg-white/[0.04]"
                        }`}
                      >
                        <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">{row.subacaoId}</td>
                        <td className="px-3 py-2.5 max-w-[80px] truncate text-slate-500" title={row.pdcaTitulo}>
                          {row.pdcaId}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${pc.badge} ${pc.color}`}>
                            {pc.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[120px] truncate text-slate-400" title={row.acao}>
                          {row.acao}
                        </td>
                        <td className="px-3 py-2.5 max-w-[200px] truncate font-medium text-slate-100" title={row.subacao}>
                          {row.subacao}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{row.responsavel || "—"}</td>
                        <td className="px-3 py-2.5 text-slate-500">{row.prazo || "—"}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${sc.badge}`}>
                            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sc.dot}`} />
                            <span className={`text-[10px] font-medium ${sc.text}`}>{sc.label}</span>
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {row.comoFazer ? (
                            <FileText className="h-3.5 w-3.5 text-[#1E7FD5]/70" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-slate-600">
                        Nenhuma tarefa encontrada com os filtros aplicados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT: side drawer ── */}
      {selectedRow && (
        <div className="w-72 shrink-0 flex flex-col overflow-hidden rounded-xl border border-[#1E7FD5]/20 bg-[#0E2539]">
          {/* Drawer header */}
          <div className="border-b border-white/10 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-mono text-[10px] text-slate-500">{selectedRow.subacaoId}</span>
                  <span className={`text-[10px] font-semibold ${PHASE_CONFIG[selectedRow.phase]?.color ?? ""}`}>
                    {PHASE_CONFIG[selectedRow.phase]?.label ?? selectedRow.phase}
                  </span>
                </div>
                <p className="text-sm font-semibold leading-snug text-slate-100">{selectedRow.subacao}</p>
                <p className="mt-1 text-xs text-slate-500 truncate">{selectedRow.acao}</p>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="shrink-0 rounded-lg p-1 hover:bg-white/10 transition-colors"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
              {(() => {
                const sc = statusConfig(selectedRow.status);
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${sc.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                    <span className={sc.text}>{sc.label}</span>
                  </span>
                );
              })()}
              {selectedRow.responsavel && (
                <span className="text-slate-500">• {selectedRow.responsavel}</span>
              )}
              {selectedRow.prazo && (
                <span className="text-slate-500">• {selectedRow.prazo}</span>
              )}
            </div>
          </div>

          {/* Drawer tab nav */}
          <div className="flex border-b border-white/10">
            {(
              [
                { key: "como",       label: "Como Fazer" },
                { key: "insumos",    label: "Insumos" },
                { key: "obs",        label: "Obs." },
                { key: "evidencias", label: "Evidências" },
              ] as { key: DrawerTab; label: string }[]
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setDrawerTab(t.key)}
                className={`flex-1 py-2 text-[10px] font-semibold transition-colors ${
                  drawerTab === t.key
                    ? "border-b-2 border-[#1E7FD5] text-[#82C4F8]"
                    : "text-slate-600 hover:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Drawer body */}
          <div className="flex-1 overflow-y-auto p-4">
            {drawerTab === "como" && (
              selectedRow.comoFazer ? (
                <ol className="space-y-2.5">
                  {selectedRow.comoFazer
                    .split(/\n|•|\d+\.\s/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <li key={i} className="flex gap-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1E7FD5]/20 text-[9px] font-bold text-[#82C4F8]">
                          {i + 1}
                        </span>
                        <span className="text-xs leading-relaxed text-slate-300">{line}</span>
                      </li>
                    ))}
                </ol>
              ) : (
                <DrawerEmpty
                  label="Como Fazer não disponível."
                  hint="Faça upload de PDF estruturado na aba PDF KNOWLEDGE para injetar este campo."
                />
              )
            )}

            {drawerTab === "insumos" && (
              <DrawerEmpty
                label="Insumos não mapeados."
                hint="Disponível após injeção via PDF KNOWLEDGE (Phase 1)."
              />
            )}

            {drawerTab === "obs" && (
              selectedRow.evidenciaSgq ? (
                <p className="text-xs leading-relaxed text-slate-300">{selectedRow.evidenciaSgq}</p>
              ) : (
                <DrawerEmpty
                  label="Sem observações do auditor."
                  hint="Campo injetado via PDF KNOWLEDGE."
                />
              )
            )}

            {drawerTab === "evidencias" && (
              <DrawerEmpty
                label="Upload de evidências disponível no Painel Executivo."
                hint={`Selecione a subação ${selectedRow.subacaoId} no painel principal para gerenciar evidências.`}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DrawerEmpty({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-2 text-[10px] leading-relaxed text-slate-700">{hint}</p>
    </div>
  );
}
