import { ChartNoAxesCombined, CircleGauge, Database, Layers, UploadCloud } from "lucide-react";
import { useAppState, PdcaView } from "@/lib/app-state";

type SidebarProps = {
  pdcaCount: number;
  subactionCount: number;
  doneCount: number;
  completion: number;
  localMode: boolean;
};

const navItems: { label: string; icon: typeof ChartNoAxesCombined; view: PdcaView }[] = [
  { label: "Painel Executivo", icon: ChartNoAxesCombined, view: "painel" },
  { label: "Portfolio PDCA", icon: Layers, view: "portfolio" },
  { label: "Importacao Excel", icon: UploadCloud, view: "importacao" },
  { label: "Persistencia SGQ", icon: Database, view: "persistencia" },
];

export function Sidebar({ pdcaCount, subactionCount, doneCount, completion, localMode }: SidebarProps) {
  const { activeView, setActiveView } = useAppState();

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/10 bg-slate-950/95 lg:block">
      <div className="flex h-full flex-col px-6 py-7">
        <div className="rounded-2xl border border-white/10 bg-slate-900/75 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">RJT</p>
          <h1 className="mt-2 text-xl font-semibold tracking-tight text-white">PDCA Brain</h1>
          <p className="mt-2 text-xs text-slate-400">Dashboard executivo orientado por subacoes</p>
        </div>

        <nav className="mt-8 space-y-2">
          {navItems.map((item) => {
            const isActive = activeView === item.view;
            return (
              <button
                key={item.label}
                onClick={() => setActiveView(item.view)}
                className={`flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white"
                    : "bg-slate-900/30 text-slate-200 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-cyan-500/20 via-blue-500/10 to-indigo-500/25 p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/80">Resumo</p>
          <div className="mt-3 space-y-2 text-sm text-slate-100">
            <p>{pdcaCount} PDCAs ativos</p>
            <p>{subactionCount} subacoes mapeadas</p>
            <p>{doneCount} subacoes concluidas</p>
            <p>Eficacia global {completion}%</p>
          </div>
        </div>

        <div className="mt-auto rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <div className="flex items-center gap-2">
            <CircleGauge className="h-4 w-4 text-emerald-300" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Ambiente</p>
          </div>
          <p className="mt-2 text-sm text-slate-200">
            {localMode
              ? "Modo local ativo (sem persistencia)"
              : "Conectado ao Supabase via API /api/pdcas"}
          </p>
        </div>
      </div>
    </aside>
  );
}
