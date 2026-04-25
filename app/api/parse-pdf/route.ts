import { NextRequest, NextResponse } from "next/server";
import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import type { PdcaAction, PdcaPhase, PdcaRecord, PdcaSubaction } from "@/lib/types";

// Force Node.js runtime (not Edge) — required for pdf-parse / pdfjs-dist
export const runtime = "nodejs";

const inflate = promisify(inflateRaw);

// ── Primary extractor: pdf-parse (pure JS, Vercel-compatible) ────────────────
// Use lib/pdf-parse directly to avoid the index.js test-mode issue in Next.js builds
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;

async function extractWithPdfParse(buf: Buffer): Promise<string> {
  const data = await pdfParse(buf);
  return data.text ?? "";
}

// ── Fallback extractor: BT/ET stream scanner (no external deps) ──────────────
// Used when pdf-parse is unavailable or fails.

function decodePdfStr(raw: string): string {
  return raw
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\(\d{3})/g, (_, oct: string) => String.fromCharCode(parseInt(oct, 8)));
}

function btTextFromStream(content: string): string {
  const parts: string[] = [];
  const btRe = /BT([\s\S]*?)ET/g;
  let block: RegExpExecArray | null;
  while ((block = btRe.exec(content)) !== null) {
    const inner = block[1];
    // (text) Tj
    const tjRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*Tj/g;
    let m: RegExpExecArray | null;
    while ((m = tjRe.exec(inner)) !== null) parts.push(decodePdfStr(m[1]));
    // [(text) -offset (text)] TJ
    const tjArrRe = /\[([\s\S]*?)\]\s*TJ/g;
    while ((m = tjArrRe.exec(inner)) !== null) {
      const strRe = /\(([^)\\]*(?:\\.[^)\\]*)*)\)/g;
      let sm: RegExpExecArray | null;
      while ((sm = strRe.exec(m[1])) !== null) {
        const d = decodePdfStr(sm[1]);
        if (d.trim()) parts.push(d);
      }
    }
  }
  return parts.filter(Boolean).join(" ");
}

async function extractPdfTextFallback(buf: Buffer): Promise<string> {
  const texts: string[] = [];
  let pos = 0;

  while (pos < buf.length - 20) {
    // Find 'stream' keyword preceded by whitespace or >
    const sPos = buf.indexOf(Buffer.from("stream"), pos);
    if (sPos < 0) break;

    const prevByte = buf[sPos - 1];
    if (prevByte !== 0x0a && prevByte !== 0x0d && prevByte !== 0x3e) {
      pos = sPos + 6;
      continue;
    }

    // Look back up to 1500 bytes for the object dictionary
    const lookback = buf.slice(Math.max(0, sPos - 1500), sPos).toString("latin1");
    const lenM = lookback.match(/\/Length\s+(\d+)/);
    if (!lenM) { pos = sPos + 6; continue; }
    const length = parseInt(lenM[1], 10);
    if (length <= 0 || length > 20_000_000) { pos = sPos + 6; continue; }

    // Skip past 'stream' + optional \r\n
    let dataStart = sPos + 6;
    if (buf[dataStart] === 0x0d) dataStart++;
    if (buf[dataStart] === 0x0a) dataStart++;

    const isFlate = /\/Filter\s*(?:\[.*?\])?\s*\/FlateDecode|\/FlateDecode/.test(lookback);
    const streamBuf = buf.slice(dataStart, dataStart + length);

    try {
      const content = isFlate
        ? (await inflate(streamBuf)).toString("latin1")
        : streamBuf.toString("latin1");

      if (content.includes("BT") && content.includes("ET")) {
        const t = btTextFromStream(content);
        if (t.length > 8) texts.push(t);
      }
    } catch { /* skip streams that fail */ }

    pos = dataStart + length;
  }

  return texts.join(" ").replace(/\s+/g, " ").trim();
}

// ── Combined extractor: pdf-parse → BT/ET fallback ────────────────────────────
async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    const text = await extractWithPdfParse(buf);
    if (text.length > 50) return text;
  } catch { /* fall through to BT/ET */ }
  return extractPdfTextFallback(buf);
}

// ── Row parsing (same logic as DOCX parser) ──────────────────────────────────

function normalizeStatus(raw: string): string {
  const v = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (v === "ok" || v.includes("conclu") || v.includes("finaliz")) return "Concluído";
  if (v === "alerta" || v.includes("execu") || v.includes("andamento")) return "Em Andamento";
  if (v === "critico" || v.includes("atras")) return "Atrasado";
  if (v.includes("pend")) return "Pendente";
  return raw || "Pendente";
}

function phaseLabel(p: PdcaPhase): PdcaAction["etapa"] {
  if (p === "plan") return "PLAN";
  if (p === "do")   return "DO";
  if (p === "check") return "CHECK";
  return "ACT";
}

type RawRow = {
  id: string; codPdca: string; phase: PdcaPhase;
  acao: string; subacao: string; responsavel: string;
  comoFazer: string; evidencias: string; indicador: string;
  meta: string; resultado: string; status: string; dataFim: string;
};

function parseRows(text: string): RawRow[] {
  const anchor = text.indexOf("COMPLETA PARA IMPORTA");
  const src = anchor >= 0 ? text.slice(anchor) : text;

  const idRe = /PDCA\d{2}-\d{2}\.\d{2}/g;
  const positions: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(src)) !== null) positions.push(m.index);

  const rows: RawRow[] = [];
  const seen = new Set<string>();

  for (let j = 0; j < positions.length; j++) {
    const start = positions[j];
    const end   = positions[j + 1] ?? Math.min(start + 900, src.length);
    const parts = src.slice(start, end).split("|").map((s) => s.trim());

    if (parts.length < 16 || !/^PDCA\d{2}$/.test(parts[1])) continue;
    const id = parts[0];
    if (seen.has(id)) continue;
    seen.add(id);

    const rawPhase = parts[2].toLowerCase();
    const phase = (["plan", "do", "check", "act"].includes(rawPhase) ? rawPhase : "do") as PdcaPhase;

    rows.push({
      id, codPdca: parts[1], phase,
      acao: parts[3] ?? "", subacao: parts[4] ?? "",
      responsavel: parts[7] ?? "", comoFazer: parts[8] ?? "",
      evidencias: parts[10] ?? "", indicador: parts[11] ?? "",
      meta: parts[12] ?? "", resultado: parts[13] ?? "",
      status: normalizeStatus(parts[14] ?? ""),
      dataFim: parts[16] ?? parts[15] ?? "",
    });
  }
  return rows;
}

function buildRecord(rows: RawRow[], filename: string): PdcaRecord {
  const codPdca = rows[0]?.codPdca ?? "PDCA01";
  const fases: Record<PdcaPhase, PdcaAction[]> = { plan: [], do: [], check: [], act: [] };
  const actionMap = new Map<string, PdcaAction>();

  for (const row of rows) {
    const key = `${row.phase}::${row.acao}`;
    if (!actionMap.has(key)) {
      const action: PdcaAction = {
        id: `${codPdca}-${row.acao.slice(0, 24).replace(/\s+/g, "-")}`,
        etapa: phaseLabel(row.phase),
        acao: row.acao,
        subacoes: [],
      };
      actionMap.set(key, action);
      fases[row.phase].push(action);
    }
    const sub: PdcaSubaction = {
      id: row.id, nome: row.subacao || row.acao, resp: row.responsavel,
      gut: 0, indicador: row.indicador, meta: row.meta,
      resultado: row.resultado, status: row.status,
      ...(row.comoFazer  ? { comoFazer: row.comoFazer }   : {}),
      ...(row.dataFim    ? { prazo: row.dataFim }          : {}),
      ...(row.evidencias ? { evidenciaSgq: row.evidencias } : {}),
    };
    actionMap.get(key)!.subacoes.push(sub);
  }

  const overallStatus = rows.every((r) => r.status.includes("Concluí"))
    ? "Concluído"
    : rows.some((r) => r.status === "Em Andamento")
    ? "Em Execução"
    : "Pendente";

  return {
    id: codPdca,
    titulo: filename.replace(/\.pdf$/i, "").replace(/^📘\s*/, "").trim(),
    area: "", situacao: overallStatus, causas: "",
    analise_gut: { g: 0, u: 0, t: 0, total: 0 },
    fases, status: overallStatus,
    fonteArquivo: filename,
    atualizadoEm: new Date().toISOString(),
  };
}

// ── Parser for TABELA_MESTRE_PDCA format (A01 01.01 / AÇÃO 01 / PDCA 07) ─────

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  "Mensal","Semanal","Trimestral","Semestral","Anual","Bimestral"];

const RESP_KEYWORDS = ["Diretoria","SGQ","Comercial","PCP","Qualidade","RH",
  "TI","Financeiro","Engenharia","Produção","Logística","Operações"];

function parseTabelaMestreFormat(text: string, filename: string): RawRow[] {
  const norm = text.replace(/\s+/g, " ").trim();

  const pdcaNumMatch = norm.match(/PDCA\s*(\d+)\s*[–\-]/i)
    ?? filename.match(/PDCA[\s_-]*0*(\d+)/i);
  const pdcaNum = pdcaNumMatch ? pdcaNumMatch[1].padStart(2, "0") : "01";
  const codPdca = `PDCA${pdcaNum}`;

  // Collect AÇÃO titles (stop before "ID SUB" header or next column data)
  const acaoTitles = new Map<string, string>();
  const acaoRe = /AÇÃO\s*(\d{1,2})\s*[–\-]\s*(.+?)(?=\s+ID\s|\s+A\d{2}\s|\s{2,}|$)/g;
  let am: RegExpExecArray | null;
  while ((am = acaoRe.exec(norm)) !== null) {
    acaoTitles.set(am[1].padStart(2, "0"), am[2].trim());
  }

  // Split on sub-action markers: A01 01.01
  const subRe = /A(\d{2})\s+(\d{2}\.\d{2})([\s\S]*?)(?=A\d{2}\s+\d{2}\.\d{2}|AÇÃO\s*\d|$)/g;
  const rows: RawRow[] = [];
  let sub: RegExpExecArray | null;

  while ((sub = subRe.exec(norm)) !== null) {
    const actionNum = sub[1];
    const subNum    = sub[2];
    const block     = sub[3].replace(/\s+/g, " ").trim();

    // Use the month as an anchor to split block into: [steps zone] [RESP] [PRAZO] [EVIDÊNCIA]
    const monthPat = new RegExp(`\\b(${MONTHS_PT.join("|")})\\b`, "i");
    const prazoM   = block.match(monthPat);
    const prazo    = prazoM?.[1] ?? "";
    const prazoIdx = prazoM ? prazoM.index! : block.length;

    // Text before month: description + steps + responsavel
    const beforeMonth = block.slice(0, prazoIdx).trim();
    // Text after month: evidência
    const afterMonth  = block.slice(prazoIdx + (prazo.length || 0)).trim();

    // Responsável: last keyword match in beforeMonth
    const respPat = new RegExp(`(${RESP_KEYWORDS.join("|")})(?:\\s*\\+\\s*(?:${RESP_KEYWORDS.join("|")}))?`, "gi");
    let respM: RegExpExecArray | null;
    let lastResp = "";
    while ((respM = respPat.exec(beforeMonth)) !== null) lastResp = respM[0];
    const responsavel = lastResp.replace(/\s+/g, " ").trim();

    // Steps zone: text before the responsavel keyword (or before month if no resp)
    const respIdx = responsavel ? beforeMonth.lastIndexOf(responsavel) : beforeMonth.length;
    const stepsZone = beforeMonth.slice(0, respIdx).trim();

    // Description: text before first numbered step in stepsZone
    const firstStepIdx = stepsZone.search(/\b1\.\s+/);
    const descricaoRaw = firstStepIdx >= 0 ? stepsZone.slice(0, firstStepIdx) : stepsZone.slice(0, 80);
    const descricao = descricaoRaw.replace(/\s+/g, " ").trim().slice(0, 140) || `Subação ${actionNum}.${subNum}`;

    // Steps: numbered items from stepsZone
    const fromStep = firstStepIdx >= 0 ? stepsZone.slice(firstStepIdx) : "";
    const items: string[] = [];
    const stepRe = /\b\d+\.\s+(.+?)(?=\s+\d+\.\s+|$)/g;
    let nm: RegExpExecArray | null;
    while ((nm = stepRe.exec(fromStep)) !== null) items.push(nm[1].trim().replace(/\s+/g, " "));
    const comoFazer = items.map((it, i) => `${i + 1}. ${it}`).join("\n");

    // Evidência: first meaningful word after month
    const evidM = afterMonth.match(/^([A-ZÁÀÂÃÉÈÍÓÔÕÚÇa-záàâãéèíóôõúç][^\s]{2,30})/);
    const evidencia = evidM?.[1] ?? "";

    rows.push({
      id:         `${codPdca}-A${actionNum}-${subNum}`,
      codPdca,
      phase:      "do" as PdcaPhase,
      acao:       acaoTitles.get(actionNum) ?? `Ação ${actionNum}`,
      subacao:    descricao,
      responsavel,
      comoFazer,
      evidencias: evidencia,
      indicador:  "",
      meta:       prazo,
      resultado:  "",
      status:     "Pendente",
      dataFim:    prazo,
    });
  }

  return rows;
}

// ── Diagnostic preview (when no parseable rows found) ────────────────────────

function buildPreview(text: string, filename: string) {
  const hasTabela = text.includes("TABELA MESTRE") || text.includes("PDCA");
  const detectedId = filename.match(/PDCA\s*0*(\d+)/i)?.[0]?.replace(/\s+/, "") ?? null;
  const charCount = text.length;
  const sampleLines = text
    .split(/\s{3,}/)
    .map((l) => l.trim())
    .filter((l) => l.length > 10)
    .slice(0, 5);

  return { hasTabela, detectedId, charCount, sampleLines };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, message: "Nenhum arquivo enviado." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ ok: false, message: "Somente arquivos .pdf são aceitos aqui." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());

    // Verify PDF signature
    if (buf.slice(0, 4).toString("ascii") !== "%PDF") {
      return NextResponse.json({ ok: false, message: "Arquivo não é um PDF válido." }, { status: 422 });
    }

    const text = await extractPdfText(buf);

    // Try pipe-format parser first, then TABELA_MESTRE format
    let rows = parseRows(text);
    if (rows.length === 0) rows = parseTabelaMestreFormat(text, file.name);

    if (rows.length > 0) {
      const record = buildRecord(rows, file.name);
      return NextResponse.json({ ok: true, pdca: record, rowCount: rows.length });
    }

    // Could not extract structured rows — return diagnostic info
    const preview = buildPreview(text, file.name);
    return NextResponse.json({
      ok: false,
      extractedText: text.length > 0,
      preview,
      rowCount: 0,
      message: text.length > 100
        ? "Texto extraído do PDF, mas formato não reconhecido. Verifique se o PDF vem de um arquivo Word/Excel."
        : "Não foi possível extrair texto do PDF. O arquivo pode ser uma imagem escaneada (sem camada de texto).",
      suggestion: "Converta o PDF para DOCX e importe pela opção 'Importar Excel / DOCX'.",
    }, { status: 422 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Falha ao processar PDF." },
      { status: 500 },
    );
  }
}
