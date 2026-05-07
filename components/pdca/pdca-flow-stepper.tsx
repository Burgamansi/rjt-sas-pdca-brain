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
  "concluído":    { ring: "border-emerald-500/60", bg: "bg-emerald-500/15",   icon: "text-emerald-600",  dot: "bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]",  label: "text-emerald-600" },
  "em andamento": { ring: "border-[#006AD7]/60",   bg: "bg-[#006AD7]/10",     icon: "text-[#006AD7]",    dot: "bg-[#006AD7] shadow-[0_0_8px_rgba(0,106,215,0.5)]",    label: "text-[#006AD7]" },
  "pendente":     { ring: "border-slate-300",      bg: "bg-slate-50",         icon: "text-slate-400",    dot: "bg-slate-300",                                          label: "text-slate-400" },
  "erro":         { ring: "border-rose-500/60",    bg: "bg-rose-500/10",      icon: "text-rose-500",     dot: "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]",     label: "text-rose-500" },
};

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "concluído") return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  if (status === "em andamento") return <Clock className="h-3.5 w-3.5 text-[#006AD7] animate-pulse" />;
  if (status === "erro") return <AlertCircle className="h-3.5 w-3.5 text-rose-500" />;
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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Jornada do PDCA</h3>
          <p className="text-[10px] text-slate-400">{completedCount} de {steps.length} etapas concluídas</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          <span className="text-[11px] font-medium text-slate-500">{Math.round((completedCount / steps.length) * 100)}%</span>
        </div>
      </div>

      {/* Connector line */}
      <div className="relative">
        <div className="absolute top-5 left-5 right-5 h-px bg-slate-200" />
        <div
          className="absolute top-5 left-5 h-px bg-gradient-to-r from-[#006AD7] to-emerald-500 transition-all duration-700"
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
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white border border-slate-100">
                    <StatusIcon status={step.status} />
                  </span>
                )}
              </div>

              {/* Label */}
              <div className="flex flex-col items-center gap-0.5 text-center">
                <span className={`text-[10px] font-semibold leading-tight ${step.status === "pendente" ? "text-slate-400" : "text-slate-700"}`}>
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
