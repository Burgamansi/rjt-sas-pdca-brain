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
        // Detecta parágrafo de fechamento após o último ")" do bullet
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
    return { border: "border-rose-500/25", bg: "bg-rose-500/8", heading: "text-rose-300", dot: "bg-rose-500", badge: "bg-rose-500/20 text-rose-300" };
  if (emoji === "🔵" || emoji === "🟣")
    return { border: "border-blue-500/25", bg: "bg-blue-500/8", heading: "text-blue-300", dot: "bg-blue-500", badge: "bg-blue-500/20 text-blue-300" };
  if (emoji === "🟢")
    return { border: "border-emerald-500/25", bg: "bg-emerald-500/8", heading: "text-emerald-300", dot: "bg-emerald-500", badge: "bg-emerald-500/20 text-emerald-300" };
  if (emoji === "🟡")
    return { border: "border-amber-500/25", bg: "bg-amber-500/8", heading: "text-amber-300", dot: "bg-amber-500", badge: "bg-amber-500/20 text-amber-300" };
  return { border: "border-slate-600/30", bg: "bg-slate-800/30", heading: "text-slate-200", dot: "bg-slate-400", badge: "bg-slate-700/60 text-slate-300" };
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
  if (!blocks.length) return <span className="text-slate-500 text-sm">—</span>;

  const sectionCount = blocks.filter(b => b.kind === "section").length;
  let stepIdx = 0;

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.kind === "intro") {
          return (
            <p key={i} className="text-sm text-slate-300 leading-relaxed px-0.5">
              {block.text}
            </p>
          );
        }

        stepIdx++;
        const t = emojiTheme(block.emoji);

        return (
          <div key={i} className={`rounded-xl border ${t.border} ${t.bg} overflow-hidden`}>
            {/* Cabeçalho */}
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

            {/* Itens numerados */}
            {block.bullets.length > 0 && (
              <ol className="px-3.5 py-3 space-y-2.5">
                {block.bullets.map((bullet, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-xs text-slate-300">
                    <span className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded-full ${t.dot} flex items-center justify-center text-[9px] font-bold text-white`}>
                      {j + 1}
                    </span>
                    <span className="leading-relaxed flex-1">{bullet}</span>
                  </li>
                ))}
              </ol>
            )}

            {/* Parágrafo de fechamento */}
            {block.closing && (
              <div className={`px-3.5 pb-3 border-t ${t.border}`}>
                <p className="pt-2.5 text-xs text-slate-400 leading-relaxed italic">{block.closing}</p>
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
  pdf: "text-red-400 bg-red-500/20",
  xlsx: "text-emerald-400 bg-emerald-500/20",
  png: "text-purple-400 bg-purple-500/20",
  jpg: "text-purple-400 bg-purple-500/20",
  docx: "text-blue-400 bg-blue-500/20",
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

  // FALLBACK: dados mock se não houver evidência (usar só se empty e sem Supabase)
  const mockFiles: EvidenceFile[] = [
    {
      id: "1",
      name: "Relatório_Auditória_Q1.pdf",
      type: "pdf",
      uploadedAt: "2024-03-15",
      size: 245000,
    },
    {
      id: "2",
      name: "Planilha_Metros.xlsx",
      type: "xlsx",
      uploadedAt: "2024-03-10",
      size: 89000,
    },
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
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed right-0 top-0 h-full w-full sm:max-w-lg bg-[#08192E] border-l border-[#1E7FD5]/20 z-50 flex flex-col">
        {/* ── Cabeçalho fixo ── */}
        <div className="flex-shrink-0 bg-[#08192E] border-b border-[#1E7FD5]/20 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{subAction.pdcaId}</span>
                <span className="text-slate-700">·</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{subAction.id}</span>
              </div>
              <h2 className="text-base font-bold text-white leading-snug line-clamp-2">{subAction.descricao}</h2>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors mt-0.5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Status + progresso inline */}
          <div className="flex items-center gap-3 mt-3">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              subAction.status?.toLowerCase().includes("conclu")
                ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-300"
                : subAction.status?.toLowerCase().includes("andamento") || subAction.status?.toLowerCase().includes("exec")
                  ? "border-amber-400/50 bg-amber-500/15 text-amber-300"
                  : "border-slate-600/50 bg-slate-700/30 text-slate-400"
            }`}>
              {subAction.status || "Pendente"}
            </span>
            {late && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                <AlertTriangle className="h-3 w-3" />
                Atrasado
              </span>
            )}
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    subAction.progresso >= 90 ? "bg-emerald-500" : subAction.progresso >= 50 ? "bg-amber-500" : "bg-rose-500"
                  }`}
                  style={{ width: `${subAction.progresso}%` }}
                />
              </div>
              <span className="text-xs font-bold tabular-nums text-slate-400 flex-shrink-0">{subAction.progresso}%</span>
            </div>
          </div>
        </div>

        {/* ── Corpo rolável ── */}
        <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-5 space-y-6">

          {/* ── Metadados ── */}
          <section className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-slate-800/50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Responsável</p>
              <p className="text-sm font-medium text-white">{subAction.responsavel || "—"}</p>
            </div>
            <div className={`rounded-xl p-3 ${late ? "bg-rose-500/10 border border-rose-500/25" : "bg-slate-800/50"}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Prazo</p>
              <p className={`text-sm font-medium ${late ? "text-rose-400" : "text-white"}`}>
                {subAction.prazo || "—"}
              </p>
            </div>
          </section>

          {/* ── Como Fazer (rich text) ── */}
          {subAction.comoFazer && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Como Fazer</p>
                <div className="flex-1 h-px bg-slate-800" />
              </div>
              <RichText text={subAction.comoFazer} />
            </section>
          )}

          {/* ── Evidência SGQ ── */}
          {subAction.evidenciaSgq && (
            <section className="rounded-xl border border-[#1E7FD5]/25 bg-[#1E7FD5]/8 p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#82C4F8] mb-1.5">Evidência SGQ Esperada</p>
              <p className="text-sm text-blue-200 font-medium leading-relaxed">{subAction.evidenciaSgq}</p>
            </section>
          )}

          {/* ── Stats inline ── */}
          <section className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-800/50 p-3">
              <Paperclip className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Arquivos</p>
                <p className="text-sm font-bold text-white">{files.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-slate-800/50 p-3">
              <Clock className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Atualização</p>
                <p className="text-sm font-bold text-white">{lastUpdate ? formatDate(lastUpdate) : "—"}</p>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">EVIDÊNCIAS</h3>
              <button
                onClick={handleFileUpload}
                disabled={isUploading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-medium transition-colors"
              >
                <Upload className="h-3 w-3" />
                {isUploading ? "Enviando..." : "Enviar"}
              </button>
            </div>

            {files.length === 0 ? (
              <div className="bg-slate-800/30 rounded-xl p-6 text-center border border-dashed border-[#1E7FD5]/20">
                <Upload className="h-8 w-8 text-slate-500 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Nenhuma evidência enviada</p>
                <p className="text-xs text-slate-500 mt-1">
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
                      className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <div
                        className={`p-2 rounded-lg ${
                          fileColors[file.type] || "text-slate-400 bg-slate-700"
                        }`}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(file.uploadedAt)} • {formatFileSize(file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">ALERTAS</h3>
            <div className="space-y-2">
              {late && (
                <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-300">Prazo Atrasado</p>
                    <p className="text-xs text-red-400/70">
                      O prazo expirou em {formatDate(subAction.prazo)}
                    </p>
                  </div>
                </div>
              )}
              {!hasEvidence && (
                <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-300">
                      Evidência Pendente
                    </p>
                    <p className="text-xs text-amber-400/70">
                      Nenhum arquivo enviado ainda
                    </p>
                  </div>
                </div>
              )}
              {subAction.progresso >= 100 && hasEvidence && (
                <div className="flex items-start gap-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">Subação Concluída</p>
                    <p className="text-xs text-emerald-400/70">
                      Todas as evidências foram enviadas
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
        </div>
      </aside>
    </>
  );
}