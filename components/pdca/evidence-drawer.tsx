"use client";

import { useEffect, useState, useRef, type ReactNode } from "react";
import {
  X,
  Upload,
  FileText,
  FileSpreadsheet,
  Image,
  File,
  Download,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle,
  Paperclip,
} from "lucide-react";

// ─── Rich Text Parser ────────────────────────────────────────────────────────

type TextBlock =
  | { kind: "intro"; text: string }
  | { kind: "section"; emoji: string; header: string; bullets: string[]; closing: string };

const EMOJI_PATTERN = /🔴|🟠|🟡|🟢|🔵|🟣|⚫|⚪|🟤|🔶|🔷|🔸|🔹/;

function parseRichText(text: string): TextBlock[] {
  if (!text?.trim()) return [];

  const parts = text.split(/(?=🔴|🟠|🟡|🟢|🔵|🟣|⚫|⚪|🟤|🔶|🔷|🔸|🔹)/);
  const blocks: TextBlock[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const emojiMatch = trimmed.match(/^(🔴|🟠|🟡|🟢|🔵|🟣|⚫|⚪|🟤|🔶|🔷|🔸|🔹)\s*([\s\S]*)$/);
    if (!emojiMatch) {
      blocks.push({ kind: "intro", text: trimmed });
      continue;
    }

    const [, emoji, rest] = emojiMatch;
    const firstBullet = rest.indexOf("•");
    const header = firstBullet === -1 ? rest.trim() : rest.substring(0, firstBullet).trim();
    const bulletText = firstBullet === -1 ? "" : rest.substring(firstBullet);

    const rawBullets = bulletText.split(/•/).filter((b) => b.trim());
    const bullets: string[] = [];
    let closing = "";

    rawBullets.forEach((raw, idx) => {
      const item = raw.trim();
      if (idx < rawBullets.length - 1) {
        bullets.push(item);
      } else {
        const match = item.match(/^([\s\S]+?\))\s+([A-ZÁÀÂÃÉÈÍÓÔÕÚÇ][\s\S]*)$/);
        if (match) {
          bullets.push(match[1].trim());
          closing = match[2].trim();
        } else {
          bullets.push(item);
        }
      }
    });

    blocks.push({ kind: "section", emoji, header, bullets, closing });
  }

  return blocks;
}

function emojiTheme(emoji: string) {
  if (emoji === "🔴" || emoji === "🟠")
    return { border: "border-rose-300/60", bg: "bg-rose-50", heading: "text-rose-700", dot: "bg-rose-500", badge: "bg-rose-100 text-rose-600" };
  if (emoji === "🔵" || emoji === "🟣")
    return { border: "border-blue-300/60", bg: "bg-blue-50", heading: "text-blue-700", dot: "bg-blue-500", badge: "bg-blue-100 text-blue-600" };
  if (emoji === "🟢")
    return { border: "border-emerald-300/60", bg: "bg-emerald-50", heading: "text-emerald-700", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-600" };
  if (emoji === "🟡")
    return { border: "border-amber-300/60", bg: "bg-amber-50", heading: "text-amber-700", dot: "bg-amber-500", badge: "bg-amber-100 text-amber-600" };
  return { border: "border-slate-200", bg: "bg-slate-50", heading: "text-slate-700", dot: "bg-slate-400", badge: "bg-slate-100 text-slate-600" };
}

function emojiLabel(emoji: string): string {
  const map: Record<string, string> = {
    "🔴": "Atenção",
    "🟠": "Aviso",
    "🟡": "Em andamento",
    "🟢": "OK / Concluído",
    "🔵": "Informação",
    "🟣": "Referência",
    "🔶": "Destaque",
    "🔷": "Processo",
    "🔸": "Detalhe",
    "🔹": "Tópico",
    "⚫": "Geral",
    "⚪": "Neutro",
    "🟤": "Histórico",
  };
  return map[emoji] ?? "Seção";
}

function RichText({ text }: { text: string }) {
  const blocks = parseRichText(text);
  if (!blocks.length) return <span className="text-slate-400 text-sm">—</span>;

  const sectionCount = blocks.filter(b => b.kind === "section").length;
  let stepIdx = 0;

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.kind === "intro") {
          return (
            <p key={i} className="text-sm text-slate-600 leading-relaxed px-0.5">
              {block.text}
            </p>
          );
        }

        stepIdx++;
        const t = emojiTheme(block.emoji);

        return (
          <div key={i} className={`rounded-xl border ${t.border} ${t.bg} overflow-hidden`}>
            <div className={`flex items-center gap-2.5 px-3.5 py-2.5 border-b ${t.border}`}>
              <span className="text-base leading-none flex-shrink-0">{block.emoji}</span>
              <div className="flex-1 min-w-0">
                {block.header ? (
                  <p className={`text-sm font-semibold leading-snug ${t.heading}`}>{block.header}</p>
                ) : (
                  <p className={`text-xs font-semibold uppercase tracking-wider opacity-80 ${t.heading}`}>
                    {emojiLabel(block.emoji)}
                  </p>
                )}
              </div>
              {sectionCount > 1 && (
                <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md ${t.badge}`}>
                  {stepIdx}/{sectionCount}
                </span>
              )}
            </div>

            {block.bullets.length > 0 && (
              <ol className="px-3.5 py-3 space-y-2.5">
                {block.bullets.map((bullet, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-xs text-slate-600">
                    <span className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded-full ${t.dot} flex items-center justify-center text-[9px] font-bold text-white`}>
                      {j + 1}
                    </span>
                    <span className="leading-relaxed flex-1">{bullet}</span>
                  </li>
                ))}
              </ol>
            )}

            {block.closing && (
              <div className={`px-3.5 pb-3 border-t ${t.border}`}>
                <p className="pt-2.5 text-xs text-slate-500 leading-relaxed italic">{block.closing}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

import { fetchEvidences, uploadEvidence, type Evidence } from "@/lib/evidences";

type EvidenceFile = {
  id: string;
  name: string;
  type: "pdf" | "xlsx" | "png" | "jpg" | "docx";
  uploadedAt: string;
  size: number;
};

type SubActionData = {
  id: string;
  pdcaId: string;
  descricao: string;
  comoFazer?: string;
  responsavel: string;
  prazo: string;
  status: string;
  progresso: number;
  evidenciaSgq?: string;
};

type EvidenceDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  subAction: SubActionData | null;
};

const fileIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  xlsx: FileSpreadsheet,
  png: Image,
  jpg: Image,
  docx: File,
};

const fileColors: Record<string, string> = {
  pdf:  "text-red-600 bg-red-100",
  xlsx: "text-emerald-600 bg-emerald-100",
  png:  "text-purple-600 bg-purple-100",
  jpg:  "text-purple-600 bg-purple-100",
  docx: "text-blue-600 bg-blue-100",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isLate(prazo: string): boolean {
  if (!prazo) return false;
  const deadline = new Date(prazo);
  return deadline.getTime() < Date.now();
}

export function EvidenceDrawer({ isOpen, onClose, subAction }: EvidenceDrawerProps) {
  const [files, setFiles] = useState<EvidenceFile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && subAction?.pdcaId && subAction?.id) {
      setLoading(true);
      fetchEvidences(subAction.pdcaId, subAction.id)
        .then((evidences) => {
          const mapped = evidences.map((e) => ({
            id: e.id,
            name: e.file_name,
            type: e.file_type as "pdf" | "xlsx" | "png" | "jpg" | "docx",
            uploadedAt: e.created_at,
            size: e.file_size || 0,
          }));
          setFiles(mapped);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, subAction?.pdcaId, subAction?.id]);

  const mockFiles: EvidenceFile[] = [
    { id: "1", name: "Relatório_Auditória_Q1.pdf", type: "pdf", uploadedAt: "2024-03-15", size: 245000 },
    { id: "2", name: "Planilha_Metros.xlsx",       type: "xlsx", uploadedAt: "2024-03-10", size: 89000 },
  ];
  const displayFiles = files.length > 0 ? files : mockFiles;

  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen || !subAction) return null;

  const late = isLate(subAction.prazo);
  const hasEvidence = files.length > 0;
  const lastUpdate = files.length > 0 ? files[files.length - 1].uploadedAt : null;

  const handleFileUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".pdf,.xlsx,.xls,.png,.jpg,.docx,.doc";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !subAction?.pdcaId || !subAction?.id) return;

      setIsUploading(true);
      const result = await uploadEvidence(subAction.pdcaId, subAction.id, file);

      if (result) {
        setFiles((prev) => [
          ...prev,
          {
            id: result.id,
            name: result.file_name,
            type: result.file_type as "pdf" | "xlsx" | "png" | "jpg" | "docx",
            uploadedAt: result.created_at,
            size: result.file_size || 0,
          },
        ]);
      }
      setIsUploading(false);
    };
    input.click();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed right-0 top-0 h-full w-full sm:max-w-lg bg-white border-l border-slate-200 z-50 flex flex-col shadow-xl">
        {/* ── Cabeçalho fixo ── */}
        <div className="flex-shrink-0 bg-white border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{subAction.pdcaId}</span>
                <span className="text-slate-300">·</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">{subAction.id}</span>
              </div>
              <h2 className="text-base font-bold text-slate-800 leading-snug line-clamp-2">{subAction.descricao}</h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors mt-0.5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Status + progresso inline */}
          <div className="flex items-center gap-3 mt-3">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              subAction.status?.toLowerCase().includes("conclu")
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-700"
                : subAction.status?.toLowerCase().includes("andamento") || subAction.status?.toLowerCase().includes("exec")
                  ? "border-amber-400/50 bg-amber-500/15 text-amber-700"
                  : "border-slate-300 bg-slate-100 text-slate-500"
            }`}>
              {subAction.status || "Pendente"}
            </span>
            {late && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/50 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
                <AlertTriangle className="h-3 w-3" />
                Atrasado
              </span>
            )}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    subAction.progresso >= 90 ? "bg-emerald-500" : subAction.progresso >= 50 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${subAction.progresso}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-slate-500 flex-shrink-0">{subAction.progresso}%</span>
            </div>
          </div>
        </div>

        {/* ── Corpo rolável ── */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="px-5 py-5 space-y-5">

            {/* ── Metadados ── */}
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white border border-slate-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Responsável</p>
                <p className="text-sm font-medium text-slate-800">{subAction.responsavel || "—"}</p>
              </div>
              <div className={`rounded-xl p-3 ${late ? "bg-rose-50 border border-rose-200" : "bg-white border border-slate-200"}`}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">Prazo</p>
                <p className={`text-sm font-medium ${late ? "text-rose-600" : "text-slate-800"}`}>
                  {subAction.prazo || "—"}
                </p>
              </div>
            </section>

            {/* ── Como Fazer (rich text) ── */}
            {subAction.comoFazer && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Como Fazer</p>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
                <RichText text={subAction.comoFazer} />
              </section>
            )}

            {/* ── Evidência SGQ ── */}
            {subAction.evidenciaSgq && (
              <section className="rounded-xl border border-[#006AD7]/20 bg-[#006AD7]/5 p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#006AD7] mb-1.5">Evidência SGQ Esperada</p>
                <p className="text-sm text-[#006AD7] font-medium leading-relaxed">{subAction.evidenciaSgq}</p>
              </section>
            )}

            {/* ── Stats inline ── */}
            <section className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 p-3">
                <Paperclip className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Arquivos</p>
                  <p className="text-sm font-bold text-slate-800">{files.length}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-white border border-slate-200 p-3">
                <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Atualização</p>
                  <p className="text-sm font-bold text-slate-800">{lastUpdate ? formatDate(lastUpdate) : "—"}</p>
                </div>
              </div>
            </section>

            {/* ── Evidências ── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Evidências</h3>
                <button
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#006AD7] hover:bg-[#0059B3] text-white text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Upload className="h-3 w-3" />
                  {isUploading ? "Enviando..." : "Enviar"}
                </button>
              </div>

              {files.length === 0 ? (
                <div className="bg-white rounded-xl p-6 text-center border border-dashed border-slate-300">
                  <Upload className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Nenhuma evidência enviada</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Arraste arquivos ou clique em Enviar
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => {
                    const IconComponent = fileIcons[file.type] || File;
                    return (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <div className={`p-2 rounded-lg ${fileColors[file.type] || "text-slate-500 bg-slate-100"}`}>
                          <IconComponent className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                          <p className="text-xs text-slate-400">
                            {formatDate(file.uploadedAt)} • {formatFileSize(file.size)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ── Alertas ── */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Alertas</h3>
              <div className="space-y-2">
                {late && (
                  <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-rose-700">Prazo Atrasado</p>
                      <p className="text-xs text-rose-500">
                        O prazo expirou em {formatDate(subAction.prazo)}
                      </p>
                    </div>
                  </div>
                )}
                {!hasEvidence && (
                  <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-700">Evidência Pendente</p>
                      <p className="text-xs text-amber-500">Nenhum arquivo enviado ainda</p>
                    </div>
                  </div>
                )}
                {subAction.progresso >= 100 && hasEvidence && (
                  <div className="flex items-start gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-emerald-700">Subação Concluída</p>
                      <p className="text-xs text-emerald-500">Todas as evidências foram enviadas</p>
                    </div>
                  </div>
                )}
                {!late && hasEvidence && subAction.progresso < 100 && (
                  <p className="text-xs text-slate-400 text-center py-2">Nenhum alerta ativo.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </aside>
    </>
  );
}
