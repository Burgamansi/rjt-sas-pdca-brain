import { LucideIcon } from "lucide-react";
import { useAppState, PdcaFilter } from "@/lib/app-state";

type KpiCardProps = {
  title: string;
  value: string;
  subtitle: string;
  gradientClassName: string;
  icon: LucideIcon;
  filter?: PdcaFilter;
};

export function KpiCard({ title, value, subtitle, gradientClassName, icon: Icon, filter }: KpiCardProps) {
  const { setSelectedFilter, selectedFilter } = useAppState();
  const isActive = filter && selectedFilter === filter;

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-white/20 p-5 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.65)] ${gradientClassName} ${
        filter ? "cursor-pointer hover:scale-[1.02] transition-transform" : ""
      } ${isActive ? "ring-2 ring-white/50" : ""}`}
      onClick={() => filter && setSelectedFilter(filter)}
    >
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15 blur-xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-white/75">{title}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-xs text-white/85">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-white/25 bg-white/10 p-2">
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </article>
  );
}