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
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">Trilha de Importação</h3>
        <p className="mt-0.5 text-xs text-slate-500">Histórico recente dos uploads processados nesta sessão.</p>
      </div>

      <div className="p-4 space-y-2">
        {!logs.length ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
            Sem eventos de upload nesta sessão.
          </p>
        ) : null}

        {logs.map((entry, index) => (
          <article
            key={`${entry.when}-${entry.file}-${index}`}
            className="group rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 shadow-sm transition-colors hover:bg-white"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-slate-800 text-sm truncate">{entry.file}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${entry.ok ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"}`}>
                {entry.ok ? "OK" : "AVISO"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600">{entry.message}</p>
            <p className="mt-1 text-[10px] text-slate-400">{formatDate(entry.when)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
