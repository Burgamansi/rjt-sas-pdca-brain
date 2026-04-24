type ImportLogEntry = {
  when: string;
  ok: boolean;
  file: string;
  message: string;
};

type ImportLogPanelProps = {
  logs: ImportLogEntry[];
  formatDate: (value: string) => string;
};

export function ImportLogPanel({ logs, formatDate }: ImportLogPanelProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 shadow-[0_28px_55px_-35px_rgba(15,23,42,0.9)]">
      <h3 className="text-lg font-semibold text-slate-100">Trilha de Importacao</h3>
      <p className="mt-1 text-sm text-slate-400">Historico recente dos uploads processados nesta sessao.</p>

      <div className="mt-4 space-y-2">
        {!logs.length ? (
          <p className="rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 text-sm text-slate-300">
            Sem eventos de upload nesta sessao.
          </p>
        ) : null}

        {logs.map((entry, index) => (
          <article
            key={`${entry.when}-${entry.file}-${index}`}
            className="group rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 shadow-sm transition-colors hover:bg-slate-700"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-white">{entry.file}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${entry.ok ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
                {entry.ok ? "OK" : "AVISO"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-300">{entry.message}</p>
            <p className="mt-1 text-xs text-slate-400">{formatDate(entry.when)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
