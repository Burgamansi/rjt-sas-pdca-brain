import * as XLSX from "xlsx";
import { PdcaAction, PdcaPhase, PdcaRecord, PdcaSubaction } from "./types";

const HEADER_ALIASES: Record<string, string[]> = {
  fase: ["fase", "etapa", "pdca", "fase pdca", "fase do pdca", "quadrante", "ciclo"],
  acao: [
    "acao principal", "acao mae", "macro acao", "macroacao",
    "acao", "atividade", "iniciativa", "id acao", "numero da acao", "cod acao",
  ],
  subacao: [
    "subacao", "sub acao", "subatividade", "item", "tarefa",
    "descricao da subacao", "acao detalhada", "o que fazer",
    "id sub", "numero da subacao", "subacao detalhada", "descricao",
  ],
  responsavel: ["responsavel", "resp", "owner", "dono", "lider"],
  gut: ["gut", "prioridade", "nota gut", "pontuacao gut", "score gut"],
  indicador: ["indicador", "kpi", "medida", "criterio de medicao"],
  meta: ["meta", "objetivo", "target"],
  resultado: ["resultado", "acumulo", "acumulado", "realizado", "progresso"],
  status: ["status", "situacao", "andamento", "estado"],
  como_fazer: ["como fazer", "metodologia", "procedimento", "descricao da acao", "como realizar", "instrucoes", "como"],
  prazo: ["prazo", "data limite", "data prevista", "deadline", "data conclusao", "dt prevista", "dt limite", "data"],
  evidencia: ["evidencia sgq", "evidencia esperada", "evidencia", "documento evidencia", "evidencia de conclusao", "evidencia objetivo", "comprovante"],
};

const TEMPLATE_COL = {
  b: 1,
  d: 3,
  g: 6,
  h: 7,
  i: 8,
  j: 9,
  k: 10,
  m: 12,
};

function normalizeText(input: unknown): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function text(value: unknown, fallback = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function parseNumber(value: unknown): number {
  const raw = String(value ?? "").trim();
  if (!raw) return Number.NaN;
  const sanitized = raw.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeId(value: string): string {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return value;
  return digits.padStart(2, "0");
}

function pdcaIdFromFileName(fileName: string): string {
  const match = fileName.match(/pdca[^0-9]*0*(\d{1,3})/i);
  if (!match?.[1]) return "";
  return normalizeId(match[1]);
}

function pdcaTitleFromFileName(fileName: string): string {
  const noExt = fileName.replace(/\.(xlsx|xls)$/i, "").trim();
  const withoutPrefix = noExt.replace(/^.*?pdca\s*0*\d+/i, "").trim();
  const cleaned = withoutPrefix.replace(/^[^\p{L}\p{N}]+/u, "").trim();
  return cleaned || noExt;
}

function canonicalStatus(raw: unknown): string {
  const value = normalizeText(raw);
  if (!value) return "Pendente";
  if (value.includes("conclu") || value.includes("finaliz") || value.includes("done")) return "Concluido";
  if (value.includes("execu") || value.includes("andamento") || value.includes("curso")) return "Em Execucao";
  if (value.includes("aberto")) return "Em Aberto";
  if (value.includes("aguard")) return "Aguardando";
  if (value.includes("pend")) return "Pendente";
  return text(raw, "Pendente");
}

function pdcaStatusFromSubactions(statuses: string[]): string {
  if (!statuses.length) return "Em Planejamento";
  const normalized = statuses.map((item) => normalizeText(item));
  if (normalized.every((item) => item.includes("conclu"))) return "Concluido";
  if (normalized.some((item) => item.includes("execu") || item.includes("aberto") || item.includes("aguard"))) {
    return "Em Execucao";
  }
  return "Pendente";
}

function phaseLabel(phase: PdcaPhase): PdcaAction["etapa"] {
  if (phase === "plan") return "PLAN";
  if (phase === "do") return "DO";
  if (phase === "check") return "CHECK";
  return "ACT";
}

function inferPhase(raw: unknown, fallback: PdcaPhase = "do"): PdcaPhase {
  const value = normalizeText(raw);
  if (!value) return fallback;
  if (value === "p" || value.includes("plan") || value.includes("planej")) return "plan";
  if (value === "d" || value.includes("do") || value.includes("execu")) return "do";
  if (value === "c" || value.includes("check") || value.includes("verific")) return "check";
  if (value === "a" || value.includes("act") || value.includes("padron")) return "act";
  return fallback;
}

function cell(rows: unknown[][], row1Based: number, colIndex: number): string {
  if (row1Based <= 0) return "";
  return text(rows[row1Based - 1]?.[colIndex], "");
}

function findRow(rows: unknown[][], matcher: (rowNumber: number) => boolean, start = 1, end = rows.length): number {
  for (let row = Math.max(1, start); row <= Math.min(end, rows.length); row += 1) {
    if (matcher(row)) return row;
  }
  return -1;
}

function hasRowText(row: unknown[] | undefined, needle: string): boolean {
  if (!row?.length) return false;
  const normalizedNeedle = normalizeText(needle);
  return row.some((value) => normalizeText(value).includes(normalizedNeedle));
}

function firstMeaningfulTextBelow(
  rows: unknown[][],
  colIndex: number,
  startRow: number,
  endRow: number,
  minLength = 20
): string {
  for (let row = Math.max(1, startRow); row <= Math.min(endRow, rows.length); row += 1) {
    const value = cell(rows, row, colIndex);
    if (value.length >= minLength) return value;
  }
  return "";
}

function extractContext(rows: unknown[][], aliasList: string[]): string {
  for (let i = 0; i < Math.min(30, rows.length); i += 1) {
    const row = rows[i];
    if (!row?.length) continue;
    const firstCell = normalizeText(row[0]);
    if (!firstCell) continue;
    if (aliasList.some((item) => firstCell.includes(item))) {
      return text(row[1], "");
    }
  }
  return "";
}

function findHeaderRow(rows: unknown[][]): number {
  let bestIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < Math.min(rows.length, 40); i += 1) {
    const row = rows[i] ?? [];
    let rowScore = 0;

    for (const item of row) {
      const candidate = normalizeText(item);
      if (!candidate) continue;
      for (const aliases of Object.values(HEADER_ALIASES)) {
        if (aliases.some((alias) => candidate === alias || candidate.includes(alias))) {
          rowScore += 1;
          break;
        }
      }
    }

    if (rowScore > bestScore) {
      bestScore = rowScore;
      bestIndex = i;
    }
  }

  return bestScore >= 3 ? bestIndex : -1;
}

function mapColumns(headerRow: unknown[]): Partial<Record<keyof typeof HEADER_ALIASES, number>> {
  const mapped: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};

  for (let i = 0; i < headerRow.length; i += 1) {
    const candidate = normalizeText(headerRow[i]);
    if (!candidate) continue;

    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (mapped[field as keyof typeof HEADER_ALIASES] !== undefined) continue;
      if (aliases.some((alias) => candidate === alias || candidate.includes(alias))) {
        mapped[field as keyof typeof HEADER_ALIASES] = i;
      }
    }
  }

  return mapped;
}

function statusFromTemplateRow(okCell: string, resultCell: string, evidenceCell: string, dateCell: string): string {
  const ok = normalizeText(okCell);
  const hasResult = Boolean(text(resultCell) || text(evidenceCell));
  const hasDate = Boolean(text(dateCell));

  if (
    ok.includes("ok") ||
    ok === "x" ||
    ok === "sim" ||
    ok.includes("conclu") ||
    ok === "1" ||
    ok === "true" ||
    hasResult
  ) {
    return "Concluido";
  }
  if (hasDate) return "Em Execucao";
  return "Pendente";
}

function extractGutTotalFromTexts(chunks: string[]): number {
  const regex = /gut[^0-9]{0,8}(\d{1,3})/gi;
  let max = 0;

  for (const chunk of chunks) {
    let match: RegExpExecArray | null = regex.exec(chunk);
    while (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) {
        max = Math.max(max, value);
      }
      match = regex.exec(chunk);
    }
    regex.lastIndex = 0;
  }

  return max;
}

function buildAction(
  phase: PdcaPhase,
  actionIndex: number,
  subStartIndex: number,
  actionName: string,
  entries: Omit<PdcaSubaction, "id">[]
): { action: PdcaAction; nextSubIndex: number } {
  const actionIdPrefix = phaseLabel(phase).charAt(0);
  const action: PdcaAction = {
    id: `${actionIdPrefix}${actionIndex}`,
    etapa: phaseLabel(phase),
    acao: actionName,
    subacoes: [],
  };

  let subCounter = subStartIndex;
  for (const entry of entries) {
    action.subacoes.push({
      ...entry,
      id: `S${actionIdPrefix}.${subCounter}`,
    });
    subCounter += 1;
  }

  return { action, nextSubIndex: subCounter };
}

function extractTemplateEntries(
  rows: unknown[][],
  startRow: number,
  endRow: number,
  mode: "do" | "check" | "act"
): Omit<PdcaSubaction, "id">[] {
  const entries: Omit<PdcaSubaction, "id">[] = [];

  for (let row = Math.max(startRow, 1); row <= Math.min(endRow, rows.length); row += 1) {
    const d = cell(rows, row, TEMPLATE_COL.d);
    const g = cell(rows, row, TEMPLATE_COL.g);
    const h = cell(rows, row, TEMPLATE_COL.h);
    const i = cell(rows, row, TEMPLATE_COL.i);
    const j = cell(rows, row, TEMPLATE_COL.j);
    const k = cell(rows, row, TEMPLATE_COL.k);
    const m = cell(rows, row, TEMPLATE_COL.m);

    const isHeaderRow =
      normalizeText(g).includes("responsavel") ||
      normalizeText(h).includes("atividades") ||
      normalizeText(h).includes("indicadores dos resultados") ||
      normalizeText(i).includes("data") ||
      normalizeText(j) === "ok";
    if (isHeaderRow) continue;

    const joined = normalizeText([d, g, h, i, j, k, m].join(" "));
    if (!joined) continue;
    if (joined.includes("revisao") || joined.includes("descricao das alteracoes")) continue;

    const nome = mode === "check" ? text(h, text(d)) : text(h, text(d));
    if (!nome || nome.length < 5) continue;

    const indicador = mode === "check" ? text(h, "Indicador de resultado") : "Atividades";
    const resultado = text(k, text(m, ""));
    const status = statusFromTemplateRow(j, k, m, i);

    entries.push({
      nome,
      resp: text(g, "Nao definido"),
      gut: 0,
      indicador,
      meta: text(i, "N/A"),
      resultado: resultado || "0",
      status,
    });
  }

  return entries;
}

function extractTemplatePdcaId(rows: unknown[][]): string {
  for (let row = 1; row <= Math.min(rows.length, 14); row += 1) {
    const values = rows[row - 1] ?? [];
    for (let c = 0; c < Math.min(values.length, 16); c += 1) {
      const current = text(values[c], "");
      const match = current.match(/pdca[^0-9]*0*(\d{1,3})/i);
      if (match?.[1]) return normalizeId(match[1]);
    }
  }
  return "";
}

function parseSgqTemplate(rows: unknown[][], fileName: string): PdcaRecord | null {
  const rowAcaoImediata = findRow(rows, (row) => normalizeText(cell(rows, row, TEMPLATE_COL.d)).includes("acao imediata"));
  const rowResultados = findRow(rows, (row) => normalizeText(cell(rows, row, TEMPLATE_COL.d)).includes("resultados obtidos"));
  const rowAcoesEficazes = findRow(rows, (row) =>
    normalizeText(cell(rows, row, TEMPLATE_COL.d)).includes("acoes eficazes")
  );

  if (rowAcaoImediata < 0 || rowResultados < 0 || rowAcoesEficazes < 0) {
    return null;
  }

  const rowConclusoes = findRow(rows, (row) => hasRowText(rows[row - 1], "Conclusões Gerais"), rowAcoesEficazes + 1);

  const rowDescricaoTitulo = findRow(rows, (row) =>
    normalizeText(cell(rows, row, TEMPLATE_COL.d)).includes("descricao da situacao")
  );
  const rowCausasTitulo = findRow(rows, (row) =>
    normalizeText(cell(rows, row, TEMPLATE_COL.k)).includes("causas identificadas")
  );
  const rowObjetivoTitulo = findRow(rows, (row) =>
    normalizeText(cell(rows, row, TEMPLATE_COL.k)).includes("objetivo principal")
  );
  const rowPropostasTitulo = findRow(rows, (row) =>
    normalizeText(cell(rows, row, TEMPLATE_COL.d)).includes("proposta de solucao 1")
  );

  const situacao =
    firstMeaningfulTextBelow(rows, TEMPLATE_COL.d, rowDescricaoTitulo + 1, rowAcaoImediata - 1, 30) ||
    `Dados importados de ${fileName}.`;
  const causas =
    firstMeaningfulTextBelow(rows, TEMPLATE_COL.k, rowCausasTitulo + 1, rowAcaoImediata - 1, 20) ||
    "Causas nao informadas no arquivo.";
  const objetivo = firstMeaningfulTextBelow(rows, TEMPLATE_COL.k, rowObjetivoTitulo + 1, rowAcaoImediata - 1, 20);

  const areaFromHeader = text(cell(rows, 4, TEMPLATE_COL.h), "");
  const areaFallbackRow = findRow(rows, (row) => normalizeText(cell(rows, row, TEMPLATE_COL.g)).includes("area:"));
  const area = areaFromHeader || text(cell(rows, areaFallbackRow, TEMPLATE_COL.h), "A definir");

  const proposalTexts =
    rowPropostasTitulo > 0
      ? [cell(rows, rowPropostasTitulo + 1, TEMPLATE_COL.d), cell(rows, rowPropostasTitulo + 1, TEMPLATE_COL.g), cell(rows, rowPropostasTitulo + 1, TEMPLATE_COL.k)].filter(
          (value) => text(value).length >= 20
        )
      : [];

  const immediateDirective = text(cell(rows, rowAcaoImediata + 1, TEMPLATE_COL.d), "");
  const doEntries = extractTemplateEntries(rows, rowAcaoImediata + 1, rowResultados - 1, "do");
  const checkEntries = extractTemplateEntries(rows, rowResultados + 1, rowAcoesEficazes - 1, "check");
  const actEntries = extractTemplateEntries(
    rows,
    rowAcoesEficazes + 1,
    (rowConclusoes > 0 ? rowConclusoes : rows.length) - 1,
    "act"
  );

  const fases: Record<PdcaPhase, PdcaAction[]> = {
    plan: [],
    do: [],
    check: [],
    act: [],
  };
  const nextAction: Record<PdcaPhase, number> = { plan: 1, do: 1, check: 1, act: 1 };
  const nextSub: Record<PdcaPhase, number> = { plan: 1, do: 1, check: 1, act: 1 };
  const statusList: string[] = [];

  const planBaseEntries: Omit<PdcaSubaction, "id">[] = [];
  if (situacao) {
    planBaseEntries.push({
      nome: "Descricao da situacao consolidada",
      resp: area || "Nao definido",
      gut: 0,
      indicador: "Diagnostico",
      meta: "Concluir analise",
      resultado: "Registrado",
      status: "Concluido",
    });
  }
  if (causas && causas !== "Causas nao informadas no arquivo.") {
    planBaseEntries.push({
      nome: "Identificacao de causas estruturais",
      resp: area || "Nao definido",
      gut: 0,
      indicador: "Analise causal",
      meta: "Definir causas",
      resultado: "Registrado",
      status: "Concluido",
    });
  }
  if (objetivo) {
    planBaseEntries.push({
      nome: "Definicao do objetivo principal do ciclo",
      resp: area || "Nao definido",
      gut: 0,
      indicador: "Objetivo",
      meta: "Objetivo formal",
      resultado: "Registrado",
      status: "Concluido",
    });
  }
  if (planBaseEntries.length) {
    const { action, nextSubIndex } = buildAction(
      "plan",
      nextAction.plan,
      nextSub.plan,
      "Diagnostico, Causas e Objetivo",
      planBaseEntries
    );
    fases.plan.push(action);
    nextAction.plan += 1;
    nextSub.plan = nextSubIndex;
    statusList.push(...action.subacoes.map((s) => s.status));
  }

  if (proposalTexts.length) {
    const proposalEntries: Omit<PdcaSubaction, "id">[] = proposalTexts.map((proposal) => ({
      nome: proposal,
      resp: area || "Nao definido",
      gut: 0,
      indicador: "Opcao de solucao",
      meta: "Avaliar e aprovar",
      resultado: "Planejado",
      status: "Em Execucao",
    }));
    const { action, nextSubIndex } = buildAction(
      "plan",
      nextAction.plan,
      nextSub.plan,
      "Opcoes de Solucao Estruturadas",
      proposalEntries
    );
    fases.plan.push(action);
    nextAction.plan += 1;
    nextSub.plan = nextSubIndex;
    statusList.push(...action.subacoes.map((s) => s.status));
  }

  const doAllEntries = [...doEntries];
  if (immediateDirective.length >= 25) {
    doAllEntries.unshift({
      nome: immediateDirective,
      resp: area || "Nao definido",
      gut: 0,
      indicador: "Diretriz",
      meta: text(cell(rows, rowAcaoImediata + 1, TEMPLATE_COL.i), "N/A"),
      resultado: text(cell(rows, rowAcaoImediata + 1, TEMPLATE_COL.k), "0"),
      status: "Em Execucao",
    });
  }
  if (doAllEntries.length) {
    const { action, nextSubIndex } = buildAction(
      "do",
      nextAction.do,
      nextSub.do,
      "Execucao das Acoes Imediatas",
      doAllEntries
    );
    fases.do.push(action);
    nextAction.do += 1;
    nextSub.do = nextSubIndex;
    statusList.push(...action.subacoes.map((s) => s.status));
  }

  if (checkEntries.length) {
    const { action, nextSubIndex } = buildAction(
      "check",
      nextAction.check,
      nextSub.check,
      "Verificacao dos Resultados",
      checkEntries
    );
    fases.check.push(action);
    nextAction.check += 1;
    nextSub.check = nextSubIndex;
    statusList.push(...action.subacoes.map((s) => s.status));
  }

  if (actEntries.length) {
    const { action, nextSubIndex } = buildAction(
      "act",
      nextAction.act,
      nextSub.act,
      "Acoes Eficazes e Revisoes",
      actEntries
    );
    fases.act.push(action);
    nextAction.act += 1;
    nextSub.act = nextSubIndex;
    statusList.push(...action.subacoes.map((s) => s.status));
  }

  const subactionCount = Object.values(fases)
    .flat()
    .reduce((acc, action) => acc + action.subacoes.length, 0);
  if (!subactionCount) {
    return null;
  }

  const id = extractTemplatePdcaId(rows) || pdcaIdFromFileName(fileName) || normalizeId(String(Date.now()).slice(-2));
  const titulo = pdcaTitleFromFileName(fileName) || `PDCA ${id}`;
  const gutTotal = extractGutTotalFromTexts([situacao, causas, objetivo, immediateDirective, ...proposalTexts]);

  return {
    id,
    titulo,
    area,
    situacao,
    causas,
    analise_gut: { g: 0, u: 0, t: 0, total: gutTotal },
    fases,
    status: pdcaStatusFromSubactions(statusList),
    fonteArquivo: fileName,
    atualizadoEm: new Date().toISOString(),
  };
}

function parseGenericTable(rows: unknown[][], fileName: string): PdcaRecord {
  const headerRowIndex = findHeaderRow(rows);
  if (headerRowIndex < 0) {
    throw new Error(
      "Cabecalho nao identificado. Necessario ter colunas de fase/acao/subacao/responsavel/gut/indicador/meta/resultado/status."
    );
  }

  const columns = mapColumns(rows[headerRowIndex]);
  if (columns.acao === undefined && columns.subacao === undefined) {
    throw new Error("Sem colunas de acao/subacao para importacao.");
  }

  const fases: Record<PdcaPhase, PdcaAction[]> = {
    plan: [],
    do: [],
    check: [],
    act: [],
  };
  const actionMap: Record<PdcaPhase, Map<string, PdcaAction>> = {
    plan: new Map(),
    do: new Map(),
    check: new Map(),
    act: new Map(),
  };
  const actionCounter: Record<PdcaPhase, number> = { plan: 1, do: 1, check: 1, act: 1 };
  const subCounter: Record<PdcaPhase, number> = { plan: 1, do: 1, check: 1, act: 1 };
  const statusList: string[] = [];
  const gutValues: number[] = [];

  for (const row of rows.slice(headerRowIndex + 1)) {
    const hasContent = row.some((item) => text(item) !== "");
    if (!hasContent) continue;

    const subacao = text(row[columns.subacao ?? -1], text(row[columns.acao ?? -1]));
    if (!subacao) continue;

    const phase = inferPhase(row[columns.fase ?? -1], inferPhase(row[columns.acao ?? -1], "do"));
    const actionName = text(row[columns.acao ?? -1], `Acao ${phaseLabel(phase)} ${actionCounter[phase]}`);

    let action = actionMap[phase].get(actionName);
    if (!action) {
      const actionPrefix = phaseLabel(phase).charAt(0);
      action = {
        id: `${actionPrefix}${actionCounter[phase]}`,
        etapa: phaseLabel(phase),
        acao: actionName,
        subacoes: [],
      };
      actionMap[phase].set(actionName, action);
      fases[phase].push(action);
      actionCounter[phase] += 1;
    }

    const gut = parseNumber(row[columns.gut ?? -1]);
    const status = canonicalStatus(row[columns.status ?? -1]);
    statusList.push(status);
    if (Number.isFinite(gut)) gutValues.push(gut);

    const comoFazer = text(row[columns.como_fazer ?? -1], "");
    const prazo = text(row[columns.prazo ?? -1], text(row[columns.meta ?? -1], ""));
    const evidenciaSgq = text(row[columns.evidencia ?? -1], "");

    action.subacoes.push({
      id: `S${phaseLabel(phase).charAt(0)}.${subCounter[phase]}`,
      nome: subacao,
      resp: text(row[columns.responsavel ?? -1], "Nao definido"),
      gut: Number.isFinite(gut) ? gut : 0,
      indicador: text(row[columns.indicador ?? -1], "Sem indicador"),
      meta: prazo || text(row[columns.meta ?? -1], "N/A"),
      resultado: text(row[columns.resultado ?? -1], "0"),
      status,
      ...(comoFazer ? { comoFazer } : {}),
      ...(prazo ? { prazo } : {}),
      ...(evidenciaSgq ? { evidenciaSgq } : {}),
    });
    subCounter[phase] += 1;
  }

  const subactionCount = Object.values(fases)
    .flat()
    .reduce((acc, action) => acc + action.subacoes.length, 0);
  if (!subactionCount) {
    throw new Error("Nenhuma subacao identificada para esse arquivo.");
  }

  const id = pdcaIdFromFileName(fileName) || normalizeId(String(Date.now()).slice(-2));
  const titulo = pdcaTitleFromFileName(fileName) || `PDCA ${id}`;
  const gutTotal = gutValues.length ? Math.max(...gutValues) : 0;

  return {
    id,
    titulo,
    area: "A definir",
    situacao:
      extractContext(rows, ["situacao", "situacao atual", "descricao da situacao"]) || `Dados importados de ${fileName}.`,
    causas:
      extractContext(rows, ["causas", "causa raiz", "causa", "ishikawa"]) || "Causas nao informadas no arquivo.",
    analise_gut: { g: 0, u: 0, t: 0, total: gutTotal },
    fases,
    status: pdcaStatusFromSubactions(statusList),
    fonteArquivo: fileName,
    atualizadoEm: new Date().toISOString(),
  };
}

export function parsePdcaWorkbookFromArrayBuffer(fileName: string, buffer: ArrayBuffer): PdcaRecord {
  const workbook = XLSX.read(buffer, { type: "array" });
  if (!workbook.SheetNames.length) {
    throw new Error("Planilha sem abas.");
  }

  const preferredSheetName =
    workbook.SheetNames.find((name) => /pdca|plano|mestre|matriz/i.test(name)) ?? workbook.SheetNames[0];
  const sheet = workbook.Sheets[preferredSheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown[][];

  if (!rows.length) {
    throw new Error("Planilha vazia.");
  }

  const templateParsed = parseSgqTemplate(rows, fileName);
  if (templateParsed) return templateParsed;

  return parseGenericTable(rows, fileName);
}
