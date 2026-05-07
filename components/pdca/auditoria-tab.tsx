"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, AlertTriangle, FileText, ExternalLink, Loader2 } from "lucide-react";
import { PdcaRecord } from "@/lib/types";
import { mapPdcaToGridRows } from "@/lib/pdca-front-mapper";
import { fetchEvidences, type Evidence } from "@/lib/evidences";

type AuditoriaTabProps = {
  pdcas: PdcaRecord[];
};

type EvidenceWithContext = Evidence & { pdcaTitulo: string };

function formatDate(d: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(d));
  } catch {
    return d;
  }
}

function fileTypeIcon(type: string): string {
  if (type === "pdf") return "📄";
  if (type === "xlsx" || type === "xls") return "📊";
  if (type === "docx" || type === "doc") return "📝";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(type)) return "🖼️";
  if (type === "mp4" || type === "mov") return "🎥";
  return "📎";
}

function truncateHash(hash: string | null | undefined): string {
  if (!hash) return "—";
  return hash.slice(0, 8) + "…";
}

export function AuditoriaTab({ pdcas }: AuditoriaTabProps) {
  const [evidences, setEvidences] = useState<EvidenceWithContext[]>([]);
  const [loading, setLoading] = useState(false);

  const allRows = useMemo(
    () =>
      pdcas.flatMap((p) =>
        mapPdcaToGridRows(p).map((r) => ({ ...r, pdcaId: p.id, pdcaTitulo: p.titulo ?? p.id }))
      ),
    [pdcas]
  );

  useEffect(() => {
    if (!pdcas.length) return;
    setLoading(true);
    const fetchAll = async () => {
      const results: EvidenceWithContext[] = [];
      for (const pdca of pdcas) {
        const rows = mapPdcaToGridRows(pdca);
        for (const row of rows) {
          const ev = await fetchEvidences(pdca.id, row.subacaoId);
          for (const e of ev) {
            results.push({ ...e, pdcaTitulo: pdca.titulo ?? pdca.id });
          }
        }
      }
      results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setEvidences(results);
      setLoading(false);
    };
    void fetchAll();
  }, [pdcas]);

  const taskIdsWithEvidence = useMemo(
    () => new Set(evidences.map((e) => e.sub_action_id)),
    [evidences]
  );

  const missingEvidence = useMemo(
    () =>
      allRows.filter((row) => {
        const isDone = row.status.toLowerCase().includes("conclu");
        return isDone && !taskIdsWithEvidence.has(row.subacaoId);
      }),
    [allRows, taskIdsWithEvidence]
  );

  const compliance =
    allRows.length > 0
      ? Math.round((taskIdsWithEvidence.size / allRows.length) * 100)
      : 0;

  const complianceColor =
    compliance >= 80
      ? "from-emerald-600 to-teal-700"
      : compliance >= 50
      ? "from-amber-500 to-orange-600"
      : "from-rose-600 to-red-700";

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {([
          {
            label: "Total Evidências",
            value: evidences.length,
            grad: "from-[#1E7FD5] to-[#1565C0]",
            Icon: FileText,
          },
          {
            label: "Tarefas com Evidência",
            value: taskIdsWithEvidence.size,
            grad: "from-emerald-600 to-teal-700",
            Icon: ShieldCheck,
          },
          {
            label: "Concluído sem Evidência",
            value: missingEvidence.length,
            grad: missingEvidence.length > 0 ? "from-rose-600 to-red-700" : "from-slate-700 to-slate-800",
            Icon: AlertTriangle,
          },
          {
            label: "Conformidade SGQ",
            value: `${compliance}%`,
            grad: complianceColor,
            Icon: ShieldCheck,
          },
        ] as const).map((kpi) => (
          <div key={kpi.label} className={`rounded-xl bg-gradient-to-br ${kpi.grad} px-4 py-3 shadow-lg`}>
            <kpi.Icon className="mb-1 h-4 w-4 text-white/60" />
            <div className="text-2xl font-bold tracking-tight text-white">{kpi.value}</div>
            <div className="mt-0.5 text-xs text-white/65">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* ISO 9001 missing evidence alerts */}
      {missingEvidence.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-amber-300">
              Alertas ISO 9001 — Evidência Faltante
            </h3>
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
              {missingEvidence.length}
            </span>
          </div>
          <div className="space-y-1.5">
            {missingEvidence.slice(0, 8).map((row, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg bg-amber-500/8 px-3 py-2 text-xs"
              >
                <span className="shrink-0 font-mono text-amber-600/80">{row.subacaoId}</span>
                <span className="flex-1 truncate text-amber-200">{row.subacao}</span>
                <span className="shrink-0 text-amber-500/70">Concluído — sem evidência</span>
              </div>
            ))}
            {missingEvidence.length > 8 && (
              <p className="px-1 text-xs text-amber-600/60">
                +{missingEvidence.length - 8} ocorrências adicionais...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Evidence table */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Registro de Evidências</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Cadeia de custódia completa — PDCA → Ação → Subação → Evidência
            </p>
          </div>
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando...
            </div>
          )}
        </div>

        {!loading && evidences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-slate-600">
            <ShieldCheck className="mb-3 h-8 w-8 opacity-20" />
            <p className="text-sm">Nenhuma evidência registrada ainda.</p>
            <p className="mt-1 text-xs">
              {pdcas.length === 0
                ? "Importe PDCAs primeiro na aba SETUP EXCEL."
                : "Faça upload de evidências no Painel Executivo."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  {[
                    "PDCA",
                    "SUBAÇÃO",
                    "ARQUIVO",
                    "TIPO",
                    "TAMANHO",
                    "UPLOADER",
                    "DATA",
                    "HASH",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidences.map((ev, idx) => (
                  <tr
                    key={ev.id}
                    className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.025] ${
                      idx % 2 !== 0 ? "bg-white/[0.015]" : ""
                    }`}
                  >
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">
                      {ev.pdca_id}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-slate-400">
                      {ev.sub_action_id}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <span>{fileTypeIcon(ev.file_type)}</span>
                        <span className="max-w-[140px] truncate" title={ev.file_name}>
                          {ev.file_name}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] uppercase text-slate-500">
                      {ev.file_type}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {ev.file_size != null
                        ? ev.file_size > 1024 * 1024
                          ? `${(ev.file_size / 1024 / 1024).toFixed(1)} MB`
                          : `${(ev.file_size / 1024).toFixed(0)} KB`
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-400">
                      {ev.uploaded_by ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">
                      {formatDate(ev.created_at)}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className="font-mono text-[10px] text-slate-600 cursor-help"
                        title={ev.id}
                      >
                        {truncateHash(ev.id)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {ev.file_url && (
                        <a
                          href={ev.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1E7FD5] transition-colors hover:text-[#82C4F8]"
                          title="Abrir evidência"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Traceability note */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-xs text-slate-600">
        <span className="font-semibold text-slate-500">ISO 9001:2015 — Cláusula 7.5.3</span>
        {" "}Controle de informação documentada. Versão completa com hash SHA-256 e rastreabilidade por UUID disponível
        após a aplicação das migrações Phase 1.
      </div>
    </div>
  );
}
