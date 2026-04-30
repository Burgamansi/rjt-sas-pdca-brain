import { NextRequest, NextResponse } from "next/server";
import { analisarDocumentoUniaoBag } from "@/lib/uniao-bag-parser";
import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";

const inflate = promisify(inflateRaw);

// ── ZIP reader ───────────────────────────────────────────────────────────────

function r16(buf: Buffer, at: number) { return buf.readUInt16LE(at); }
function r32(buf: Buffer, at: number) { return buf.readUInt32LE(at); }

async function extractDocumentXml(buf: Buffer): Promise<string> {
  let i = 0;
  while (i < buf.length - 30) {
    if (r32(buf, i) !== 0x04034b50) { i++; continue; }
    const method = r16(buf, i + 8);
    const cSize  = r32(buf, i + 18);
    const fnLen  = r16(buf, i + 26);
    const exLen  = r16(buf, i + 28);
    const name   = buf.slice(i + 30, i + 30 + fnLen).toString("utf8");
    const start  = i + 30 + fnLen + exLen;
    if (name === "word/document.xml") {
      const chunk = buf.slice(start, start + cSize);
      if (method === 0) return chunk.toString("utf8");
      if (method === 8) return (await inflate(chunk)).toString("utf8");
      throw new Error(`Unsupported ZIP method: ${method}`);
    }
    i = start + cSize;
  }
  throw new Error("word/document.xml not found.");
}

// ── XML helpers ──────────────────────────────────────────────────────────────

function nodeText(xml: string): string {
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

type Block =
  | { type: "para"; text: string; xml: string }
  | { type: "table"; rows: string[][] };

function extractBlocks(xml: string): Block[] {
  const blocks: Block[] = [];
  // Match top-level <w:p> and <w:tbl> nodes in document order
  const re = /(<w:p[\s>][\s\S]*?<\/w:p>|<w:tbl[\s>][\s\S]*?<\/w:tbl>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const raw = m[1];
    if (raw.startsWith("<w:tbl")) {
      const rows: string[][] = [];
      const trRe = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
      let tr: RegExpExecArray | null;
      while ((tr = trRe.exec(raw)) !== null) {
        const cells: string[] = [];
        const tcRe = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
        let tc: RegExpExecArray | null;
        while ((tc = tcRe.exec(tr[0])) !== null) cells.push(nodeText(tc[0]));
        if (cells.some(c => c.length > 0)) rows.push(cells);
      }
      if (rows.length > 0) blocks.push({ type: "table", rows });
    } else {
      const text = nodeText(raw);
      if (text) blocks.push({ type: "para", text, xml: raw });
    }
  }
  return blocks;
}

// ── Subaction column mapping ─────────────────────────────────────────────────

function n(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function mapSubactionCols(header: string[]): Record<string, number> {
  const find = (...terms: string[]) => {
    for (const t of terms) {
      const i = header.findIndex(h => n(h).includes(t));
      if (i !== -1) return i;
    }
    return -1;
  };
  return {
    subacao:      find("subacao", "subação", "atividade", "o que", "what"),
    como_fazer:   find("como", "how"),
    responsavel:  find("resp", "responsavel"),
    prazo:        find("prazo", "deadline", "data fim", "due"),
    evidencia:    find("evidencia", "evidence", "evidenc"),
  };
}

type Subacao = { subacao: string; como_fazer: string; responsavel: string; prazo: string; evidencia: string };

function tableToSubacoes(rows: string[][]): Subacao[] {
  if (rows.length < 2) return [];
  const cols = mapSubactionCols(rows[0]);
  const get = (row: string[], key: string) => {
    const i = cols[key];
    return i !== -1 ? (row[i] ?? "") : "";
  };
  return rows.slice(1).map(row => ({
    subacao:     get(row, "subacao")     || row[0] || "",
    como_fazer:  get(row, "como_fazer"),
    responsavel: get(row, "responsavel"),
    prazo:       get(row, "prazo"),
    evidencia:   get(row, "evidencia"),
  })).filter(s => s.subacao.trim().length > 0);
}

// ── Document parser ──────────────────────────────────────────────────────────

const ACAO_RE  = /^[AÀÂ][CÇ][AÀÂ][OÕ]\s*0*(\d+)/i;
const PDCA_RE  = /PDCA\s*0*(\d+)/i;
const TITLE_RE = /(?:PDCA|PLANO|PLAN)\s*.{0,80}/i;

function parseDocument(xml: string) {
  const blocks = extractBlocks(xml);
  let titulo = "";
  const acoes: Array<{ titulo: string; subacoes: Subacao[] }> = [];
  let currentAcao: { titulo: string; subacoes: Subacao[] } | null = null;

  for (const block of blocks) {
    if (block.type === "para") {
      const { text } = block;

      // Capture PDCA title from first heading or first PDCA-matching paragraph
      if (!titulo && (PDCA_RE.test(text) || TITLE_RE.test(text))) {
        titulo = text.slice(0, 120);
        continue;
      }

      // Detect AÇÃO 01, AÇÃO 02, … headers
      if (ACAO_RE.test(text)) {
        currentAcao = { titulo: text.slice(0, 120), subacoes: [] };
        acoes.push(currentAcao);
      }
    } else {
      // Table — attach to current action if one is open
      if (currentAcao) {
        const subs = tableToSubacoes(block.rows);
        if (subs.length > 0) currentAcao.subacoes.push(...subs);
      }
    }
  }

  return { titulo, acoes };
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, message: "Nenhum arquivo enviado." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ ok: false, message: "Somente .docx são aceitos." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const xml = await extractDocumentXml(buf);
    let { titulo, acoes } = parseDocument(xml);

    if (acoes.length === 0) {
      const plainText = extractBlocks(xml).map(b => b.type === "para" ? b.text : b.rows.map(r => r.join(" | ")).join("\n")).join("\n");
      const tarefasUniao = analisarDocumentoUniaoBag(plainText);
      
      if (tarefasUniao.length > 0) {
        titulo = titulo || file.name.replace(/\.docx$/i, "");
        acoes = [{
          titulo: "Ações União Bag",
          subacoes: tarefasUniao.map(t => ({
            subacao: t.titulo,
            como_fazer: t.comoFazer,
            responsavel: t.responsavel,
            prazo: "",
            evidencia: "",
            status: t.status || "Pendente"
          }))
        }];
      }
    }

    const totalSubacoes = acoes.reduce((s, a) => s + a.subacoes.length, 0);
    if (acoes.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Nenhuma ação (AÇÃO 01, AÇÃO 02…) encontrada no documento." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      pdca: { titulo, acoes },
      acaoCount: acoes.length,
      subacaoCount: totalSubacoes,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, message: err instanceof Error ? err.message : "Falha ao processar DOCX." },
      { status: 500 },
    );
  }
}
