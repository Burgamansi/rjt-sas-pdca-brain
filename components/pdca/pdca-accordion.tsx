import { BarChart3, CalendarClock, ChevronDown, ChevronUp, CircleAlert, ListChecks, UserRound } from "lucide-react";
import { PdcaPhase, PdcaRecord } from "@/lib/types";

export type PdcaComputedMetrics = {
  totalSubactions: number;
  doneCount: number;
  progressCount: number;
  pendingCount: number;
  criticalCount: number;
  withDeadline: number;
  withEvidence: number;
  progress: number;
};

type PdcaAccordionProps = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  metricsByPdca: Record<string, PdcaComputedMetrics>;
  loading: boolean;
  localMode: boolean;
  formatDate: (value: string) => string;
  statusKind: (status: string) => "done" | "progress" | "pending";
};

const phaseOrder: PdcaPhase[] = ["plan", "do", "check", "act"];
const phaseNames: Record<PdcaPhase, string> = {
  plan: "PLAN",
  do: "DO",
  check: "CHECK",
  act: "ACT",
};

function statusClass(kind: "done" | "progress" | "pending") {
  if (kind === "done") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (kind === "progress") return "border-amber-400/35 bg-amber-400/10 text-amber-200";
  return "border-indigo-300/35 bg-indigo-300/10 text-indigo-200";
}

export function PdcaAccordion({
  pdcas,
  selectedPdcaId,
  onSelectPdca,
  metricsByPdca,
  loading,
  localMode,
  formatDate,
  statusKind,
}: PdcaAccordionProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_28px_55px_-35px_rgba(15,23,42,0.9)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Portfolio de PDCAs</h3>
          <p className="mt-1 text-sm text-slate-400">Cada card expande com subacoes por fase e dados operacionais.</p>
        </div>
      </div>

      {loading ? <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-300">Carregando dados...</p> : null}
      {!loading && !pdcas.length ? (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-300">
          {localMode ? "Sem PDCAs carregados nesta sessao local." : "Ainda sem PDCAs sincronizados no Supabase."}
        </p>
      ) : null}

      <div className="space-y-3">
        {pdcas.map((pdca) => {
          const metrics = metricsByPdca[pdca.id];
          const open = selectedPdcaId === pdca.id;
          const kind = statusKind(pdca.status);

          return (
            <article
              key={pdca.id}
              className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/50 shadow-[0_25px_45px_-38px_rgba(15,23,42,0.95)]"
            >
              <button
                type="button"
                onClick={() => onSelectPdca(open ? "" : pdca.id)}
                className="w-full px-4 py-4 text-left"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">PDCA {pdca.id}</p>
                    <h4 className="mt-1 truncate text-base font-semibold text-slate-100">{pdca.titulo}</h4>
                    <p className="mt-1 text-sm text-slate-400">{pdca.area}</p>
                    <p className="mt-1 text-xs text-slate-500">Atualizado: {formatDate(pdca.atualizadoEm)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(kind)}`}>
                      {pdca.status}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs text-slate-300">
                      Progresso {metrics.progress}% {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </div>
                </div>

                <div className="mt-3 h-2 w-full rounded-full bg-slate-800">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-all"
                    style={{ width: `${metrics.progress}%` }}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1">
                    <ListChecks className="h-3.5 w-3.5" />
                    {metrics.totalSubactions} subacoes
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    {metrics.doneCount} concluidas
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {metrics.withDeadline} com prazo
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1">
                    <CircleAlert className="h-3.5 w-3.5" />
                    {metrics.criticalCount} criticas
                  </span>
                </div>
              </button>

              {open ? (
                <div className="border-t border-slate-700/80 bg-slate-950/60 p-4">
                  <div className="mb-4 grid gap-2 text-xs text-slate-300 md:grid-cols-3">
                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
                      Em execucao: <strong>{metrics.progressCount}</strong>
                    </div>
                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
                      Pendentes: <strong>{metrics.pendingCount}</strong>
                    </div>
                    <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3">
                      Com evidencia: <strong>{metrics.withEvidence}</strong>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {phaseOrder.map((phase) => {
                      const actions = pdca.fases[phase];
                      const phaseSubCount = actions.reduce((acc, action) => acc + action.subacoes.length, 0);

                      if (!phaseSubCount) return null;

                      return (
                        <section key={phase} className="rounded-2xl border border-slate-700/75 bg-slate-900/50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h5 className="text-sm font-semibold text-slate-100">{phaseNames[phase]}</h5>
                            <span className="text-xs text-slate-400">{phaseSubCount} subacoes</span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-slate-700/75">
                            <table className="min-w-full text-left text-xs">
                              <thead className="bg-slate-800/70 text-slate-300">
                                <tr>
                                  <th className="px-3 py-2">Subacao</th>
                                  <th className="px-3 py-2">Responsavel</th>
                                  <th className="px-3 py-2">Prazo</th>
                                  <th className="px-3 py-2">Metodo/Indicador</th>
                                  <th className="px-3 py-2">Evidencia</th>
                                  <th className="px-3 py-2">GUT</th>
                                  <th className="px-3 py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {actions.flatMap((action) =>
                                  action.subacoes.map((subaction) => (
                                    <tr key={`${action.id}-${subaction.id}`} className="border-t border-slate-800 text-slate-200">
                                      <td className="px-3 py-2">
                                        <p className="font-medium text-slate-100">{subaction.nome}</p>
                                        <p className="mt-1 text-[11px] text-slate-400">{action.acao}</p>
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="inline-flex items-center gap-1">
                                          <UserRound className="h-3 w-3" />
                                          {subaction.resp}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2">{subaction.meta || "--"}</td>
                                      <td className="px-3 py-2">{subaction.indicador || "--"}</td>
                                      <td className="px-3 py-2">{subaction.resultado || "--"}</td>
                                      <td className="px-3 py-2">{subaction.gut}</td>
                                      <td className="px-3 py-2">
                                        <span className={`inline-flex rounded-full border px-2 py-0.5 ${statusClass(statusKind(subaction.status))}`}>
                                          {subaction.status}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
