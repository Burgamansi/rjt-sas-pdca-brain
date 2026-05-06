export interface TarefaPDCA {
  titulo: string;
  comoFazer: string;
  responsavel: string;
  status: string;
}

function safeTrim(str: string | undefined | null): string {
  return str?.trim() || "";
}

function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function extractTitle(texto: string): string {
  const patterns = [
    /ação[:\s]+(.+?)(?=\n|responsável|objetivo|meta|prioridade|$)/i,
    /atividade[:\s]+(.+?)(?=\n|responsável|objetivo|meta|prioridade|$)/i,
    /tarefa[:\s]+(.+?)(?=\n|responsável|objetivo|meta|prioridade|$)/i,
    /objetivo[:\s]+(.+?)(?=\n|responsável|ação|meta|prioridade|$)/i,
    /^[\d\.\-\s]*\s*[:\-]?\s*(.+?)(?=\n|$)/m,
  ];
  for (const re of patterns) {
    const m = texto.match(re);
    if (m && m[1] && m[1].length > 2) return safeTrim(m[1]);
  }
  return texto.substring(0, 80).trim() || "Sem título";
}

function extractComoFazer(textBlock: string, startIdx: number, linhas: string[]): string {
  const steps: string[] = [];
  const maxLines = 10;
  for (let i = startIdx; i < Math.min(startIdx + maxLines, linhas.length); i++) {
    const linha = linhas[i];
    if (/^(ação|atividade|responsável|objetivo|meta|prioridade)/i.test(linha)) break;
    if (/^\d+[\.\)]\s/.test(linha) || /^(passo|etapa|item)/i.test(linha)) {
      steps.push(linha.replace(/^\s*[\d\.\)\-]+\s*/, "").trim());
    } else if (linha.length > 20 && !linha.includes(":")) {
      steps.push(linha.trim());
    }
  }
  return steps.length > 0 ? steps.join("\n") : "—";
}

function extractResponsavel(textBlock: string): string {
  const respPatterns = [
    /responsável\s*[:\-]?\s*(.+?)(?=\n|$)/i,
    /resp\.?\s*[:\-]?\s*(.+?)(?=\n|$)/i,
    /owner\s*[:\-]?\s*(.+?)(?=\n|$)/i,
  ];
  for (const re of respPatterns) {
    const m = textBlock.match(re);
    if (m && m[1]) return safeTrim(m[1]);
  }
  return "Pendente";
}

function extractStatus(textBlock: string): string {
  const norm = normalizeText(textBlock).toLowerCase();
  if (norm.includes("conclu") || norm.includes("finaliz") || norm.includes("done")) return "Concluído";
  if (norm.includes("execu") || norm.includes("andamento") || norm.includes("progress")) return "Em Andamento";
  if (norm.includes("atras") || norm.includes("critico") || norm.includes("late")) return "Atrasado";
  return "Pendente";
}

function extractMeta(textBlock: string): string {
  const metaPatterns = [
    /prazo[:\s]+(.+?)(?=\n|$)/i,
    /meta[:\s]+(.+?)(?=\n|$)/i,
    /deadline[:\s]+(.+?)(?=\n|$)/i,
    /\d{1,2}\/\d{1,2}\/\d{2,4}/,
  ];
  for (const re of metaPatterns) {
    const m = textBlock.match(re);
    if (m && m[1]) return safeTrim(m[1]);
    if (m) return m[0];
  }
  return "";
}

export const analisarDocumentoUniaoBag = (textoBruto: string): TarefaPDCA[] => {
  const tarefas: TarefaPDCA[] = [];
  if (!textoBruto || textoBruto.length < 50) return tarefas;

  const normalized = normalizeText(textoBruto);
  const linhas = textoBruto.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  const acaoMarkers = [
    /ação\s*[:\-]?\s*/i,
    /atividade\s*[:\-]?\s*/i,
    /tarefa\s*[:\-]?\s*/i,
    /objetivo\s*[:\-]?\s*/i,
    /item\s*\d+\s*[:\-]?\s*/i,
  ];

  const blockSep = /(?:ação|atividade|tarefa|objetivo|item\s*\d+)\s*[:\-]?\s*/i;
  const blocks = textoBruto.split(blockSep).filter(b => b.trim().length > 10);

  blocks.forEach((block, idx) => {
    const blockNorm = normalizeText(block);
    if (blockNorm.length < 15) return;

    const titulo = extractTitle(block);
    const comoFazer = extractComoFazer(block, 0, block.split('\n'));
    const responsavel = extractResponsavel(block);
    const status = extractStatus(block);
    const meta = extractMeta(block);

    if (titulo && titulo !== "Sem título") {
      tarefas.push({
        titulo,
        comoFazer: comoFazer !== "—" ? comoFazer : meta || "—",
        responsavel,
        status
      });
    }
  });

  if (tarefas.length === 0 && normalized.includes("ação")) {
    const actionRe = /(?:ação|atividade|tarefa)\s*[:\-]?\s*(.+?)(?=\n|$)/gi;
    let match;
    while ((match = actionRe.exec(textoBruto)) !== null && tarefas.length < 50) {
      const title = safeTrim(match[1]);
      if (title && title.length > 3) {
        tarefas.push({
          titulo: title,
          comoFazer: "—",
          responsavel: "Pendente",
          status: "Pendente"
        });
      }
    }
  }

  return tarefas.slice(0, 100);
};
