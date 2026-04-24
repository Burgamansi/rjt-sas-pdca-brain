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
            className={`rounded-xl border px-3 py-2 text-xs ${
              entry.ok
                ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                : "border-amber-400/30 bg-amber-500/10 text-amber-100"
            }`}
          >
            <p className="font-semibold">{entry.ok ? "OK" : "AVISO"} - {entry.file}</p>
            <p className="mt-1">{entry.message}</p>
            <p className="mt-1 text-[11px] opacity-80">{formatDate(entry.when)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
