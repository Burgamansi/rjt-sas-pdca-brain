"use client";

import { Check, AlertCircle, Clock, Upload, FileSearch, GitBranch, ListTree, Paperclip, LayoutDashboard } from "lucide-react";
import { useAppState, useFilteredData } from "@/lib/app-state";

type StepStatus = "pendente" | "em andamento" | "concluído" | "erro";

type Step = {
  id: number;
  label: string;
  desc: string;
  icon: typeof Upload;
  status: StepStatus;
};

function deriveSteps(
  pdcaCount: number,
  subactionCount: number,
  withEvidence: number,
  completion: number,
  loading: boolean,
  selectedPdcaId: string,
): Step[] {
  const hasData = pdcaCount > 0;
  const hasSubs = subactionCount > 0;
  const hasEvidence = withEvidence > 0;
  const hasDashboard = completion > 0;

  return [
    {
      id: 1,
      label: "Upload da Ação Macro",
      desc: hasData ? `${pdcaCount} PDCA(s) carregado(s)` : loading ? "Carregando..." : "Nenhum arquivo importado",
      icon: Upload,
      status: loading ? "em andamento" : hasData ? "concluído" : "pendente",
    },
    {
      id: 2,
      label: "Leitura e Validação",
      desc: hasData ? "Excel validado com sucesso" : "Aguardando upload",
      icon: FileSearch,
      status: hasData ? "concluído" : loading ? "em andamento" : "pendente",
    },
    {
      id: 3,
      label: "Geração do PDCA",
      desc: selectedPdcaId ? `PDCA ${selectedPdcaId} ativo` : "Aguardando dados",
      icon: GitBranch,
      status: selectedPdcaId ? "concluído" : hasData ? "em andamento" : "pendente",
    },
    {
      id: 4,
      label: "Geração das Subações",
      desc: hasSubs ? `${subactionCount} subações geradas` : "Aguardando PDCA",
      icon: ListTree,
      status: hasSubs ? "concluído" : selectedPdcaId ? "em andamento" : "pendente",
    },
    {
      id: 5,
      label: "Anexação de Evidências",
      desc: hasEvidence ? `${withEvidence} evidência(s) registrada(s)` : "Nenhuma evidência ainda",
      icon: Paperclip,
      status: hasEvidence ? "concluído" : hasSubs ? "em andamento" : "pendente",
    },
    {
      id: 6,
      label: "Atualização do Dashboard",
      desc: hasDashboard ? `Eficácia: ${completion}%` : "Aguardando dados",
      icon: LayoutDashboard,
      status: hasDashboard ? "concluído" : hasSubs ? "em andamento" : "pendente",
    },
  ];
}

const STATUS_CONFIG: Record<StepStatus, { ring: string; bg: string; icon: string; dot: string; label: string }> = {
  "concluído":    { ring: "border-emerald-500/60", bg: "bg-emerald-500/15",   icon: "text-emerald-400",  dot: "bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.7)]",   label: "text-emerald-400" },
  "em andamento": { ring: "border-cyan-500/60",    bg: "bg-cyan-500/10",      icon: "text-cyan-400",     dot: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.7)]",     label: "text-cyan-400" },
  "pendente":     { ring: "border-slate-700/50",   bg: "bg-slate-800/40",     icon: "text-slate-500",    dot: "bg-slate-600",                                           label: "text-slate-500" },
  "erro":         { ring: "border-rose-500/60",    bg: "bg-rose-500/10",      icon: "text-rose-400",     dot: "bg-rose-400 shadow-[0_0_8px_rgba(239,68,68,0.7)]",      label: "text-rose-400" },
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "concluído") return <Check className="h-3.5 w-3.5 text-emerald-400" />;
  if (status === "em andamento") return <Clock className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />;
  if (status === "erro") return <AlertCircle className="h-3.5 w-3.5 text-rose-400" />;
  return null;
}

export function PdcaFlowStepper({ loading }: { loading: boolean }) {
  const { selectedPdcaId, pdcas } = useAppState();
  const { stats } = useFilteredData();

  const steps = deriveSteps(
    stats.pdcaCount,
    stats.subactionCount,
    stats.withEvidence,
    stats.completion,
    loading,
    selectedPdcaId,
  );

  const completedCount = steps.filter((s) => s.status === "concluído").length;

  return (
    <section className="rounded-2xl border border-white/8 bg-slate-900/60 p-4 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.5)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Jornada do PDCA</h3>
          <p className="text-[10px] text-slate-500">{completedCount} de {steps.length} etapas concluídas</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-700/50 bg-slate-800/60 px-3 py-1">
          <span className="text-[11px] font-medium text-slate-400">{Math.round((completedCount / steps.length) * 100)}%</span>
        </div>
      </div>

      {/* Connector line */}
      <div className="relative">
        <div className="absolute top-5 left-5 right-5 h-px bg-slate-800" />
        <div
          className="absolute top-5 left-5 h-px bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-700"
          style={{ width: `calc(${(completedCount / (steps.length - 1)) * 100}% - 40px)` }}
        />
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {steps.map((step) => {
          const cfg = STATUS_CONFIG[step.status];
          const Icon = step.icon;
          return (
            <div key={step.id} className="relative flex flex-col items-center gap-1.5 pt-0">
              {/* Circle */}
              <div className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 ${cfg.ring} ${cfg.bg} transition-all duration-300`}>
                <Icon className={`h-4 w-4 ${cfg.icon}`} />
                {step.status !== "pendente" && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900">
                    <StatusIcon status={step.status} />
                  </span>
                )}
              </div>

              {/* Label */}
              <div className="flex flex-col items-center gap-0.5 text-center">
                <span className={`text-[10px] font-semibold leading-tight ${step.status === "pendente" ? "text-slate-500" : "text-slate-300"}`}>
                  {step.label}
                </span>
                <span className={`text-[9px] leading-tight ${cfg.label}`}>
                  {step.desc}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
