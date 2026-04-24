"use client";

import { useState } from "react";
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

type EvidenceFile = {
  id: string;
  name: string;
  type: "pdf" | "xlsx" | "png" | "jpg" | "docx";
  uploadedAt: string;
  size: number;
};

type SubActionData = {
  id: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  status: string;
  progresso: number;
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
  const [files, setFiles] = useState<EvidenceFile[]>([
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
  ]);

  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen || !subAction) return null;

  const late = isLate(subAction.prazo);
  const hasEvidence = files.length > 0;
  const lastUpdate = files.length > 0 ? files[files.length - 1].uploadedAt : null;

  const handleFileUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setFiles((prev) => [
        ...prev,
        {
          id: String(prev.length + 1),
          name: `Novo_Arquivo_${prev.length + 1}.pdf`,
          type: "pdf",
          uploadedAt: new Date().toISOString(),
          size: Math.random() * 500000,
        },
      ]);
      setIsUploading(false);
    }, 1000);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Detalhes da Subação</h2>
            <p className="text-sm text-slate-400">{subAction.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">INFORMAÇÕES</h3>
            <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs text-slate-500 mb-1">Descrição</p>
                <p className="text-sm font-medium text-white">{subAction.descricao}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Responsável</p>
                  <p className="text-sm font-medium text-white">{subAction.responsavel}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Prazo</p>
                  <p className={`text-sm font-medium ${late ? "text-red-400" : "text-white"}`}>
                    {subAction.prazo || "--"}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Status</p>
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    subAction.status === "Concluído"
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                      : "border-amber-400 bg-amber-500/20 text-amber-300"
                  }`}
                >
                  {subAction.status}
                </span>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-300">ANDAMENTO</h3>
              <span className="text-lg font-bold text-cyan-400">
                {subAction.progresso}%
              </span>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${
                    subAction.progresso >= 90
                      ? "bg-emerald-500"
                      : subAction.progresso >= 70
                        ? "bg-amber-500"
                        : "bg-rose-500"
                  }`}
                  style={{ width: `${subAction.progresso}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Arquivos</p>
                    <p className="text-sm font-semibold text-white">{files.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-500">Última Atualização</p>
                    <p className="text-sm font-semibold text-white">
                      {lastUpdate ? formatDate(lastUpdate) : "--"}
                    </p>
                  </div>
                </div>
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
              <div className="bg-slate-800/30 rounded-xl p-6 text-center border border-dashed border-slate-700">
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
      </aside>
    </>
  );
}