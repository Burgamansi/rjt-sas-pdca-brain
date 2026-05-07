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
  { label: "Painel Executivo", desc: "Dashboard e KPIs",   icon: LayoutDashboard, view: "painel" },
  { label: "Portfolio PDCA",   desc: "Gestão do portfólio", icon: Layers,          view: "portfolio" },
  { label: "SETUP PDCA",       desc: "Upload e setup",      icon: UploadCloud,     view: "setup" },
  { label: "Persistência SGQ", desc: "Sincronização",       icon: Database,        view: "persistencia" },
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
      {isOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/[0.08] bg-[#21277B] transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#9AD9EA] to-[#006AD7] shadow-[0_0_18px_rgba(154,217,234,0.35)]">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">PDCA Brain</h1>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/40">SGQ · ISO 9001</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Navegação</p>
          <div className="space-y-0.5">
            {NAV.map((item) => {
              const active = activeView === item.view;
              return (
                <button
                  key={item.view}
                  onClick={() => handleNav(item.view)}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150 ${
                    active
                      ? "bg-white/[0.12] text-white"
                      : "text-white/60 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-[#9AD9EA] shadow-[0_0_8px_rgba(154,217,234,0.8)]" />
                  )}
                  <item.icon
                    className={`h-4 w-4 flex-shrink-0 transition-colors ${
                      active ? "text-[#9AD9EA]" : "text-white/40 group-hover:text-white/70"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${active ? "text-white" : ""}`}>{item.label}</p>
                    <p className="truncate text-[10px] text-white/30">{item.desc}</p>
                  </div>
                  {active && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#9AD9EA]" />}
                </button>
              );
            })}
          </div>

          {/* Portfolio summary */}
          <div className="mt-7">
            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">Resumo do Portfólio</p>
            <div className="rounded-2xl border border-white/[0.08] bg-black/[0.15] p-4 space-y-4">

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-white/60">Eficácia Global</span>
                  <span className={`text-sm font-bold tabular-nums ${
                    completion >= 70 ? "text-emerald-300" : completion >= 40 ? "text-amber-300" : "text-rose-300"
                  }`}>
                    {completion}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      completion >= 70 ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" :
                      completion >= 40 ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]" :
                      "bg-rose-400 shadow-[0_0_6px_rgba(251,113,133,0.5)]"
                    }`}
                    style={{ width: `${Math.min(completion, 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-black/[0.15] px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">PDCAs</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{pdcaCount}</p>
                </div>
                <div className="rounded-lg bg-black/[0.15] px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">Subações</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-white">{subactionCount}</p>
                </div>
                <div className="rounded-lg bg-emerald-500/20 border border-emerald-400/20 px-3 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-300/70">Concluídas</p>
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-emerald-300">{doneCount}</p>
                </div>
                <div className={`rounded-lg px-3 py-2.5 ${pendingCount > 0 ? "bg-amber-500/15 border border-amber-400/20" : "bg-black/[0.15]"}`}>
                  <p className={`text-[10px] font-medium uppercase tracking-wider ${pendingCount > 0 ? "text-amber-300/70" : "text-white/40"}`}>Pendentes</p>
                  <p className={`mt-0.5 text-xl font-bold tabular-nums ${pendingCount > 0 ? "text-amber-300" : "text-white/50"}`}>{pendingCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* PDCA cycle bar */}
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/[0.15] p-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">Ciclo PDCA</p>
            <div className="flex h-2 overflow-hidden rounded-full">
              <div className="flex-1 bg-blue-400" title="PLAN" />
              <div className="flex-1 bg-emerald-400 ml-px" title="DO" />
              <div className="flex-1 bg-amber-400 ml-px" title="CHECK" />
              <div className="flex-1 bg-rose-400 ml-px" title="ACT" />
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {[
                { label: "PLAN",  color: "text-blue-300" },
                { label: "DO",    color: "text-emerald-300" },
                { label: "CHECK", color: "text-amber-300" },
                { label: "ACT",   color: "text-rose-300" },
              ].map((p) => (
                <p key={p.label} className={`text-center text-[10px] font-bold ${p.color}`}>{p.label}</p>
              ))}
            </div>
          </div>
        </nav>

        {/* Connection status */}
        <div className="border-t border-white/[0.08] px-4 py-4">
          <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
            localMode
              ? "border-amber-400/25 bg-amber-400/10"
              : "border-emerald-400/25 bg-emerald-400/10"
          }`}>
            {localMode ? (
              <WifiOff className="h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
            ) : (
              <Wifi className="h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-semibold ${localMode ? "text-amber-200" : "text-emerald-200"}`}>
                {localMode ? "Modo Local" : "Supabase Ativo"}
              </p>
              <p className="truncate text-[10px] text-white/30">
                {localMode ? "Sem persistência" : "/api/pdcas · sincronizado"}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
