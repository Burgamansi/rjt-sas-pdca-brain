import { Layers, RefreshCcw, Upload } from "lucide-react";

type TopBarProps = {
  importing: boolean;
  loading: boolean;
  localMode: boolean;
  onRefresh: () => void;
  onOpenImport: () => void;
};

export function TopBar({ importing, loading, localMode, onRefresh, onOpenImport }: TopBarProps) {
  return (
    <header className="rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-4 shadow-[0_28px_55px_-35px_rgba(15,23,42,0.9)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Dashboard corporativo</p>
          <div className="mt-2 flex items-center gap-2">
            <Layers className="h-6 w-6 text-cyan-300" />
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">PDCA Performance Center</h2>
          </div>
          <p className="mt-2 text-sm text-slate-400">
            {localMode
              ? "Modo local: dados desta sessao nao sao persistidos no Supabase."
              : "Pipeline ativo: Excel -> API -> Supabase -> Dashboard."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="inline-flex items-center rounded-xl border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-300/50"
            onClick={onRefresh}
            disabled={loading}
            type="button"
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </button>
          <button
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-[0_10px_30px_-12px_rgba(59,130,246,0.9)] transition hover:from-blue-400 hover:to-indigo-400"
            onClick={onOpenImport}
            disabled={importing}
            type="button"
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importando..." : "Importar Excel"}
          </button>
        </div>
      </div>
    </header>
  );
}
