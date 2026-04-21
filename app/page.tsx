"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileSpreadsheet, Layers, RefreshCcw, Upload } from "lucide-react";
import { parsePdcaWorkbookFromArrayBuffer } from "@/lib/pdca-parser";
import { PdcaImportResult, PdcaRecord } from "@/lib/types";

type ImportLogEntry = {
  when: string;
  ok: boolean;
  file: string;
  message: string;
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function statusKind(status: string): "done" | "progress" | "pending" {
  const text = normalizeText(status);
  if (text.includes("conclu")) return "done";
  if (text.includes("execu") || text.includes("aberto") || text.includes("aguard")) return "progress";
  return "pending";
}

function countSubacoes(pdca: PdcaRecord): number {
  return Object.values(pdca.fases)
    .flat()
    .reduce((acc, action) => acc + action.subacoes.length, 0);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

export default function Page() {
  const [pdcas, setPdcas] = useState<PdcaRecord[]>([]);
  const [selectedPdcaId, setSelectedPdcaId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<ImportLogEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function loadPdcas() {
    try {
      setLoading(true);
      const response = await fetch("/api/pdcas", { method: "GET" });
      const payload = (await response.json()) as { ok: boolean; pdcas?: PdcaRecord[]; message?: string };

      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "Falha ao buscar dados.");
        setLoading(false);
        return;
      }

      setPdcas(payload.pdcas ?? []);
      if (!selectedPdcaId && payload.pdcas?.length) {
        setSelectedPdcaId(payload.pdcas[0].id);
      }
      setLoading(false);
    } catch {
      setMessage("Falha de rede ao carregar dados.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPdcas();
  }, []);

  const selectedPdca = useMemo(() => {
    return pdcas.find((pdca) => pdca.id === selectedPdcaId) ?? null;
  }, [pdcas, selectedPdcaId]);

  const stats = useMemo(() => {
    const allSubactions = pdcas.flatMap((pdca) =>
      Object.values(pdca.fases)
        .flat()
        .flatMap((action) => action.subacoes)
    );
    const done = allSubactions.filter((subaction) => statusKind(subaction.status) === "done").length;
    const critical = allSubactions.filter(
      (subaction) => subaction.gut >= 100 && statusKind(subaction.status) !== "done"
    ).length;

    return {
      pdcaCount: pdcas.length,
      subactionCount: allSubactions.length,
      done,
      critical,
      completion: allSubactions.length ? Math.round((done / allSubactions.length) * 100) : 0,
    };
  }, [pdcas]);

  async function uploadExcelFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((file) => /\.(xlsx|xls)$/i.test(file.name));
    if (!files.length) return;

    setImporting(true);
    setMessage("");

    const parsed: PdcaRecord[] = [];
    const importResults: PdcaImportResult[] = [];

    for (const file of files) {
      try {
        const buffer = await file.arrayBuffer();
        const pdca = parsePdcaWorkbookFromArrayBuffer(file.name, buffer);
        parsed.push(pdca);
        importResults.push({
          ok: true,
          file: file.name,
          message: `PDCA ${pdca.id} pronto para sincronizar (${countSubacoes(pdca)} subacoes).`,
          pdca,
        });
      } catch (error) {
        importResults.push({
          ok: false,
          file: file.name,
          message: error instanceof Error ? error.message : "Falha ao processar arquivo.",
        });
      }
    }

    if (parsed.length) {
      try {
        const response = await fetch("/api/pdcas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdcas: parsed }),
        });
        const payload = (await response.json()) as { ok: boolean; message?: string };
        setMessage(payload.message ?? "Upload finalizado.");
        if (response.ok && payload.ok) {
          await loadPdcas();
        }
      } catch {
        setMessage("Falha de rede ao sincronizar com Supabase.");
      }
    } else {
      setMessage("Nenhum arquivo valido foi importado.");
    }

    const now = new Date().toISOString();
    setLogs((prev) => {
      const next = [
        ...importResults.map((result) => ({
          when: now,
          ok: result.ok,
          file: result.file,
          message: result.message,
        })),
        ...prev,
      ];
      return next.slice(0, 30);
    });

    setImporting(false);
  }

  return (
    <main className="container">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <h1 className="title">
          <Layers size={34} />
          PDCA Brain
        </h1>
        <div className="row">
          <button className="btn ghost" onClick={() => void loadPdcas()} disabled={loading}>
            <RefreshCcw size={16} style={{ marginRight: 6 }} />
            Atualizar
          </button>
          <button className="btn primary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            <Upload size={16} style={{ marginRight: 6 }} />
            {importing ? "Importando..." : "Importar Excel"}
          </button>
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".xlsx,.xls"
            multiple
            onChange={async (event) => {
              await uploadExcelFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      </div>

      <section className="panel" style={{ marginBottom: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700 }}>Arquitetura ativa</div>
            <div className="muted" style={{ fontSize: 13 }}>
              GitHub + Vercel + Supabase como cerebro central do projeto.
            </div>
          </div>
          <div className="row muted" style={{ alignItems: "center", fontWeight: 600, fontSize: 13 }}>
            <FileSpreadsheet size={16} />
            Upload incremental por atualizacao
          </div>
        </div>
        {message ? <p style={{ margin: "10px 0 0", fontWeight: 700 }}>{message}</p> : null}
      </section>

      <section className="kpi-grid" style={{ marginBottom: 14 }}>
        <article className="kpi">
          <div className="label">PDCAs</div>
          <div className="value">{stats.pdcaCount}</div>
        </article>
        <article className="kpi">
          <div className="label">Subacoes</div>
          <div className="value">{stats.subactionCount}</div>
        </article>
        <article className="kpi">
          <div className="label">Concluidas</div>
          <div className="value">{stats.done}</div>
        </article>
        <article className="kpi">
          <div className="label">Criticas GUT</div>
          <div className="value">{stats.critical}</div>
        </article>
        <article className="kpi">
          <div className="label">Eficacia</div>
          <div className="value">{stats.completion}%</div>
        </article>
      </section>

      <section className="row" style={{ alignItems: "flex-start" }}>
        <div className="panel" style={{ flex: 1, minWidth: 340 }}>
          <h2 style={{ marginTop: 0 }}>Portfolio PDCA</h2>
          {loading ? <p className="muted">Carregando...</p> : null}
          {!loading && !pdcas.length ? <p className="muted">Ainda sem PDCAs sincronizados no Supabase.</p> : null}
          <div className="pdca-list">
            {pdcas.map((pdca) => (
              <article key={pdca.id} className="pdca-card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <strong>PDCA {pdca.id}</strong>
                  <span className={`badge ${statusKind(pdca.status)}`}>{pdca.status}</span>
                </div>
                <h3 style={{ marginBottom: 8 }}>{pdca.titulo}</h3>
                <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>
                  {pdca.area}
                </p>
                <p className="muted" style={{ margin: "0 0 10px", fontSize: 12 }}>
                  Atualizado: {formatDate(pdca.atualizadoEm)}
                </p>
                <button className="btn" onClick={() => setSelectedPdcaId(pdca.id)}>
                  Abrir plano
                </button>
              </article>
            ))}
          </div>
        </div>

        <div className="panel" style={{ flex: 1, minWidth: 340 }}>
          <h2 style={{ marginTop: 0 }}>Detalhe</h2>
          {!selectedPdca ? (
            <p className="muted">Selecione um PDCA para visualizar os dados.</p>
          ) : (
            <>
              <h3 style={{ margin: "0 0 6px" }}>
                PDCA {selectedPdca.id} - {selectedPdca.titulo}
              </h3>
              <p className="muted" style={{ marginTop: 0, marginBottom: 12 }}>
                Fonte: {selectedPdca.fonteArquivo || "--"}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>Fase</th>
                    <th>Acao</th>
                    <th>Subacao</th>
                    <th>Resp</th>
                    <th>GUT</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(["plan", "do", "check", "act"] as const).flatMap((phase) =>
                    selectedPdca.fases[phase].flatMap((action) =>
                      action.subacoes.map((subaction) => (
                        <tr key={`${phase}-${action.id}-${subaction.id}`}>
                          <td>{action.etapa}</td>
                          <td>{action.acao}</td>
                          <td>{subaction.nome}</td>
                          <td>{subaction.resp}</td>
                          <td>{subaction.gut}</td>
                          <td>
                            <span className={`badge ${statusKind(subaction.status)}`}>{subaction.status}</span>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </>
          )}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Trilha de importacao</h2>
        <div className="log">
          {!logs.length ? <p className="muted">Sem eventos de upload nesta sessao.</p> : null}
          {logs.map((entry, index) => (
            <article key={`${entry.when}-${entry.file}-${index}`} className={`log-item ${entry.ok ? "ok" : "warn"}`}>
              <div style={{ fontWeight: 800 }}>
                {entry.ok ? "OK" : "AVISO"} - {entry.file}
              </div>
              <div>{entry.message}</div>
              <div className="muted">{formatDate(entry.when)}</div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
