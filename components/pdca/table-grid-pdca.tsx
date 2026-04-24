import { Activity, Percent } from "lucide-react";
import { PdcaPhase, PdcaRecord } from "@/lib/types";
import { PdcaGridRow, groupByPhase, mapPdcaToGridRows } from "@/lib/pdca-front-mapper";
import { useAppState } from "@/lib/app-state";

type TableGridPDCAProps = {
  pdcas: PdcaRecord[];
  selectedPdcaId: string;
  onSelectPdca: (id: string) => void;
  loading: boolean;
  localMode: boolean;
  onSelectSubAction?: (subaction: PdcaGridRow) => void;
};

type StatusKind = "done" | "progress" | "late";

const phaseStyle: Record<PdcaPhase, { label: string; bar: string; chip: string; block: string; row: string }> = {
  plan: {
    label: "PLAN",
    bar: "bg-blue-400",
    chip: "border-blue-300/40 bg-blue-400/10 text-blue-200",
    block: "border-blue-400/25 bg-blue-500/[0.05]",
    row: "bg-blue-500/[0.05]",
  },
  do: {
    label: "DO",
    bar: "bg-emerald-400",
    chip: "border-emerald-300/40 bg-emerald-400/10 text-emerald-200",
    block: "border-emerald-400/25 bg-emerald-500/[0.05]",
    row: "bg-emerald-500/[0.05]",
  },
  check: {
    label: "CHECK",
    bar: "bg-amber-400",
    chip: "border-amber-300/40 bg-amber-400/10 text-amber-200",
    block: "border-amber-400/25 bg-amber-500/[0.05]",
    row: "bg-amber-500/[0.05]",
  },
  act: {
    label: "ACT",
    bar: "bg-rose-400",
    chip: "border-rose-300/40 bg-rose-400/10 text-rose-200",
    block: "border-rose-400/25 bg-rose-500/[0.05]",
    row: "bg-rose-500/[0.05]",
  },
};

const statusStyle: Record<StatusKind, { label: string; className: string }> = {
  done: {
    label: "Concluido",
    className: "border-emerald-300/45 bg-emerald-400/10 text-emerald-200",
  },
  progress: {
    label: "Em andamento",
    className: "border-amber-300/45 bg-amber-400/10 text-amber-200",
  },
  late: {
    label: "Atrasado",
    className: "border-rose-300/45 bg-rose-400/10 text-rose-200",
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
    const parsed = new Date(year, month, day, 23, 59, 59, 999);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const iso = new Date(raw);
  if (Number.isNaN(iso.getTime())) return null;
  return iso;
}

function statusKind(status: string, prazo: string): StatusKind {
  const normalized = normalizeText(status);
  if (normalized.includes("conclu") || normalized.includes("finaliz") || normalized.includes("done")) {
    return "done";
  }
  if (normalized.includes("atras")) return "late";

  const deadline = parsePrazo(prazo);
  if (deadline && deadline.getTime() < Date.now()) {
    return "late";
  }

  return "progress";
}

function selectedPdca(pdcas: PdcaRecord[], selectedPdcaId: string): PdcaRecord | null {
  if (!pdcas.length) return null;
  return pdcas.find((pdca) => pdca.id === selectedPdcaId) ?? pdcas[0];
}

function rowKey(row: PdcaGridRow, index: number): string {
  return `${row.phase}-${row.acao}-${row.subacao}-${index}`;
}

function resultPercent(value: string): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const withPercent = raw.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (withPercent?.[1]) {
    const parsed = Number(withPercent[1].replace(",", "."));
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  const justNumber = raw.match(/^(-?\d+(?:[.,]\d+)?)$/);
  if (!justNumber?.[1]) return null;
  const parsed = Number(justNumber[1].replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0 || parsed > 100) return null;
  return Math.round(parsed);
}

function progressBarColor(percent: number): string {
  if (percent >= 90) return "bg-emerald-400";
  if (percent >= 70) return "bg-amber-400";
  return "bg-rose-400";
}

function progressBarWidth(percent: number): string {
  if (percent >= 90) return "w-[90%]";
  if (percent >= 70) return "w-[70%]";
  return "w-[50%]";
}

export function TableGridPDCA({ pdcas, selectedPdcaId, onSelectPdca, loading, localMode, onSelectSubAction }: TableGridPDCAProps) {
  const { selectedFilter, selectedPhase, setSelectedPhase } = useAppState();
  const current = selectedPdca(pdcas, selectedPdcaId);
  let rows = current ? mapPdcaToGridRows(current) : [];
  
  // Aplicar filtros
  if (selectedPhase !== "all") {
    rows = rows.filter(row => row.phase === selectedPhase);
  }
  if (selectedFilter !== "all") {
    const statusMap: Record<string, string> = {
      done: "conclu",
      progress: "exec",
      late: "atras",
      pending: "pendente"
    };
    rows = rows.filter(row => row.status.toLowerCase().includes(statusMap[selectedFilter]));
  }
  
  const groupedRows = groupByPhase(rows);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_28px_55px_-35px_rgba(15,23,42,0.9)]">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-white">PDCA Executivo</h3>
          <p className="mt-2 text-sm text-slate-300 font-medium leading-relaxed">
            Matriz de Ações - ETAPA | AÇÃO | SUBAÇÃO | RESPONSÁVEL | RESULTADO | STATUS | PRAZO
          </p>
        </div>

        <label className="text-sm font-medium text-slate-200">
          Selecionar PDCA
          <select
            className="mt-2 block min-w-56 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-white focus:border-cyan-400 focus:outline-none"
            value={current?.id ?? ""}
            onChange={(event) => onSelectPdca(event.target.value)}
            disabled={!pdcas.length}
          >
            {pdcas.map((pdca) => (
              <option key={pdca.id} value={pdca.id}>
                {pdca.id} - {pdca.titulo}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {(["plan", "do", "check", "act"] as PdcaPhase[]).map((phase) => (
          <button
            key={phase}
            onClick={() => setSelectedPhase(selectedPhase === phase ? "all" : phase)}
            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-medium ${
              selectedPhase === phase 
                ? "ring-2 ring-white/50 " + phaseStyle[phase].chip 
                : phaseStyle[phase].chip
            } hover:opacity-80 transition-all`}
          >
            <span className={`h-2 w-2 rounded-full ${phaseStyle[phase].bar}`} />
            {phaseStyle[phase].label}
          </button>
        ))}
        <button
          onClick={() => setSelectedPhase("all")}
          className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-medium ${
            selectedPhase === "all"
              ? "ring-2 ring-white/50 border-slate-400 bg-slate-700 text-white"
              : "border-slate-600 bg-slate-800 text-slate-400 hover:text-white"
          } hover:opacity-80 transition-all`}
        >
          Todos
        </button>
      </div>

      {loading ? <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-300">Carregando dados...</p> : null}
      {!loading && !pdcas.length ? (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-300">
          {localMode ? "Sem PDCAs carregados nesta sessao local." : "Ainda sem PDCAs sincronizados no Supabase."}
        </p>
      ) : null}

      {groupedRows.length ? (
        <div className="space-y-4">
          {groupedRows.map((group) => {
            const phase = phaseStyle[group.phase];

            return (
              <section key={group.phase} className={`overflow-hidden rounded-2xl border ${phase.block}`}>
                <div className="flex items-center gap-3 border-b border-slate-800/70 bg-slate-950/55 px-3 py-2">
                  <span className={`h-8 w-1.5 rounded-full ${phase.bar}`} />
                  <h4 className="text-sm font-semibold text-slate-100">{phase.label}</h4>
                  <span className="text-xs text-slate-400">{group.rows.length} subacoes</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-[980px] w-full text-left text-sm font-medium">
                    <thead className="bg-slate-800 text-slate-200 border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-200">ETAPA</th>
                        <th className="px-4 py-3 font-semibold text-slate-200">AÇÃO</th>
                        <th className="px-4 py-3 font-semibold text-slate-200">SUBAÇÃO</th>
                        <th className="px-4 py-3 font-semibold text-slate-200">RESPONSÁVEL</th>
                        <th className="px-4 py-3 font-semibold text-slate-200">RESULTADO</th>
                        <th className="px-4 py-3 font-semibold text-slate-200">STATUS</th>
                        <th className="px-4 py-3 font-semibold text-slate-200">PRAZO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700 bg-slate-900/50">
                      {group.rows.map((row, index) => {
                        const kind = statusKind(row.status, row.prazo);
                        const status = statusStyle[kind];
                        const late = kind === "late";
                        const percent = resultPercent(row.resultado);

                        return (
                          <tr key={rowKey(row, index)} className={`${phase.row} text-slate-100`}>
                            <td className="px-3 py-2.5">
                              <div className="inline-flex items-center gap-2">
                                <span className={`h-6 w-1 rounded-full ${phase.bar}`} />
                                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${phase.chip}`}>
                                  {phase.label}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-slate-100">{row.acao || "--"}</td>
                            <td className="px-4 py-3 text-white font-semibold cursor-pointer hover:text-cyan-300 transition-colors" onClick={() => onSelectSubAction?.(row)}>
                                {row.subacao || "--"}
                              </td>
                            <td className="px-4 py-3 text-white font-medium">{row.responsavel || "--"}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  <Activity className="h-4 w-4 text-cyan-400" />
                                  <span className="text-white font-medium">{row.resultado || "--"}</span>
                                  {percent !== null ? (
                                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                      percent >= 90 ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300' :
                                      percent >= 70 ? 'border-amber-400 bg-amber-500/20 text-amber-300' :
                                      'border-rose-400 bg-rose-500/20 text-rose-300'
                                    }`}>
                                      <Percent className="h-3 w-3" />
                                      {percent}%
                                    </span>
                                  ) : null}
                                </div>
                                {percent !== null && (
                                  <div className="h-1.5 w-full rounded-full bg-slate-700 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        percent >= 90 ? 'bg-emerald-500' :
                                        percent >= 70 ? 'bg-amber-500' :
                                        'bg-rose-500'
                                      }`}
                                      style={{ width: `${percent}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td className={`px-3 py-2.5 ${late ? "text-rose-300" : "text-slate-200"}`}>{row.prazo || "--"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      {!loading && current && !rows.length ? (
        <p className="rounded-xl border border-slate-700/60 bg-slate-900/45 p-4 text-sm text-slate-300">
          Este PDCA nao possui subacoes para exibir.
        </p>
      ) : null}
    </section>
  );
}
