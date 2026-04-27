"use client";

import { Database, Layers, LayoutDashboard, TrendingUp, UploadCloud, Wifi, WifiOff, X } from "lucide-react";
import { useAppState, useFilteredData, PdcaView } from "@/lib/app-state";

type SidebarProps = {
  pdcaCount: number;
  subactionCount: number;
  doneCount: number;
  completion: number;
  localMode: boolean;
  isOpen: boolean;
  onClose: () => void;
};

const NAV: { label: string; desc: string; icon: typeof LayoutDashboard; view: PdcaView }[] = [
  { label: "Painel Executivo", desc: "Dashboard e KPIs", icon: LayoutDashboard, view: "painel" },
  { label: "Portfolio PDCA", desc: "Gestão do portfólio", icon: Layers, view: "portfolio" },
  { label: "Importar Excel", desc: "Upload e validação", icon: UploadCloud, view: "importacao" },
  { label: "Persistência SGQ", desc: "Sincronização", icon: Database, view: "persistencia" },
];

export function Sidebar({ pdcaCount, subactionCount, doneCount, completion, localMode, isOpen, onClose }: SidebarProps) {
  const { activeView, setActiveView } = useAppState();
  const pendingCount = subactionCount - doneCount;

  function handleNav(view: PdcaView) {
    setActiveView(view);
    onClose();
  }

  return (
    <>
      {/* Overlay mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-[#1E7FD5]/15 bg-[#08192E] transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-[#1E7FD5]/15 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#82C4F8] to-[#1E7FD5] shadow-[0_0_18px_rgba(30,127,213,0.45)]">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">PDCA Brain</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">SGQ · ISO 9001</p>
            </div>
          </div>
          {/* Botão fechar — só no mobile */}
          <button
            onClick={onClose}
            className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Navegação</p>
          <div className="space-y-0.5">
            {NAV.map((item) => {
              const active = activeView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => handleNav(item.view)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                    active
                      ? "bg-[#1E7FD5]/10 text-white"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[#1E7FD5] shadow-[0_0_8px_rgba(30,127,213,0.9)]" />
                  )}
                  <item.icon
                    className={`h-4 w-4 flex-shrink-0 transition-colors ${
                      active ? "text-[#1E7FD5]" : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${active ? "text-white" : ""}`}>{item.label}</p>
                    <p className="truncate text-[10px] text-slate-600">{item.desc}</p>
                  </div>
                  {active && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1E7FD5]" />}
                </button>
              );
            })}
          </div>

          {/* Stats */}
          <div className="mt-7">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">Resumo do Portfólio</p>
            <div className="rounded-2xl border border-[#1E7FD5]/12 bg-[#08192E]/80 p-4 space-y-4">

              {/* Eficácia */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-400">Eficácia Global</span>
                  <span className={`text-sm font-bold tabular-nums ${
                    completion >= 70 ? "text-emerald-400" : completion >= 40 ? "text-amber-400" : "text-rose-400"
                  }`}>
                    {completion}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completion >= 70 ? "bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" :
                      completion >= 40 ? "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.6)]" :
                      "bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"
                    }`}
                    style={{ width: `${Math.min(completion, 100)}%` }}
                  />
                </div>
              </div>

              {/* Grid de números */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-[#08192E]/90 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">PDCAs</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{pdcaCount}</p>
                </div>
                <div className="rounded-lg bg-[#08192E]/90 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Subações</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{subactionCount}</p>
                </div>
                <div className="rounded-lg bg-emerald-900/30 border border-emerald-800/40 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">Concluídas</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-400">{doneCount}</p>
                </div>
                <div className={`rounded-lg px-3 py-2.5 ${pendingCount > 0 ? "bg-amber-900/20 border border-amber-800/30" : "bg-[#08192E]/90"}`}>
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${pendingCount > 0 ? "text-amber-600" : "text-slate-500"}`}>Pendentes</p>
                  <p className={`mt-0.5 text-xl font-bold tabular-nums ${pendingCount > 0 ? "text-amber-400" : "text-slate-500"}`}>{pendingCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Fases mini bar */}
          <div className="mt-5 rounded-2xl border border-[#1E7FD5]/12 bg-[#08192E]/80 p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Ciclo PDCA</p>
            <div className="flex h-2 overflow-hidden rounded-full">
              <div className="flex-1 bg-blue-600" title="PLAN" />
              <div className="flex-1 bg-emerald-600 ml-px" title="DO" />
              <div className="flex-1 bg-amber-500 ml-px" title="CHECK" />
              <div className="flex-1 bg-rose-600 ml-px" title="ACT" />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[
                { label: "PLAN", color: "text-blue-400" },
                { label: "DO", color: "text-emerald-400" },
                { label: "CHECK", color: "text-amber-400" },
                { label: "ACT", color: "text-rose-400" },
              ].map((p) => (
                <p key={p.label} className={`text-center text-[10px] font-bold ${p.color}`}>{p.label}</p>
              ))}
            </div>
          </div>
        </nav>

        {/* Connection status */}
        <div className="border-t border-[#1E7FD5]/15 px-4 py-4">
          <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
            localMode
              ? "border-amber-500/25 bg-amber-500/10"
              : "border-emerald-500/25 bg-emerald-500/10"
          }`}>
            {localMode ? (
              <WifiOff className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
            ) : (
              <Wifi className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${localMode ? "text-amber-300" : "text-emerald-300"}`}>
                {localMode ? "Modo Local" : "Supabase Ativo"}
              </p>
              <p className="truncate text-[10px] text-slate-500">
                {localMode ? "Sem persistência" : "/api/pdcas · sincronizado"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
