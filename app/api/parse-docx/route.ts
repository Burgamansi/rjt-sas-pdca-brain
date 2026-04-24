import { NextRequest, NextResponse } from "next/server";
import { inflateRaw } from "node:zlib";
import { promisify } from "node:util";
import type { PdcaAction, PdcaPhase, PdcaRecord, PdcaSubaction } from "@/lib/types";

const inflate = promisify(inflateRaw);

// ── Minimal ZIP reader (no external deps) ───────────────────────────────────

function r16(buf: Buffer, at: number) { return buf.readUInt16LE(at); }
function r32(buf: Buffer, at: number) { return buf.readUInt32LE(at); }

async function extractDocumentXml(buf: Buffer): Promise<string> {
  const target = "word/document.xml";
  let i = 0;
  while (i < buf.length - 30) {
    if (r32(buf, i) !== 0x04034b50) { i++; continue; }
    const method = r16(buf, i + 8);
    const cSize  = r32(buf, i + 18);
    const fnLen  = r16(buf, i + 26);
    const exLen  = r16(buf, i + 28);
    const name   = buf.slice(i + 30, i + 30 + fnLen).toString("utf8");
    const start  = i + 30 + fnLen + exLen;
    if (name === target) {
      const chunk = buf.slice(start, start + cSize);
      if (method === 0) return chunk.toString("utf8");
      if (method === 8) return (await inflate(chunk)).toString("utf8");
      throw new Error(`Compressão ZIP não suportada (método ${method})`);
    }
    i = start + cSize;
  }
  throw new Error("word/document.xml não encontrado no arquivo DOCX.");
}

function xmlToText(xml: string): string {
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// ── Status normalization ────────────────────────────────────────────────────

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
  if (p === "do") return "DO";
  if (p === "check") return "CHECK";
  return "ACT";
}

// ── Row parser ──────────────────────────────────────────────────────────────

type RawRow = {
  id: string;
  codPdca: string;
  phase: PdcaPhase;
  acao: string;
  subacao: string;
  responsavel: string;
  comoFazer: string;
  evidencias: string;
  indicador: string;
  meta: string;
  resultado: string;
  status: string;
  dataFim: string;
};

function parseRows(text: string): RawRow[] {
  // Prefer the machine-readable "COMPLETA PARA IMPORTAÇÃO" section
  const anchor = text.indexOf("COMPLETA PARA IMPORTA");
  const src = anchor >= 0 ? text.slice(anchor) : text;

  // Collect positions of all PDCA ID matches (e.g. PDCA01-01.01)
  const idRe = /PDCA\d{2}-\d{2}\.\d{2}/g;
  const positions: Array<{ index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = idRe.exec(src)) !== null) positions.push({ index: m.index });

  const rows: RawRow[] = [];
  const seen = new Set<string>();

  for (let j = 0; j < positions.length; j++) {
    const start = positions[j].index;
    const end   = positions[j + 1]?.index ?? Math.min(start + 900, src.length);
    const chunk = src.slice(start, end).trim();
    const parts = chunk.split("|").map((s) => s.trim());

    // COMPLETA format: ID | PDCAXX | ETAPA | ACAO | SUBACAO | ... (≥16 cols)
    if (parts.length < 16 || !/^PDCA\d{2}$/.test(parts[1])) continue;

    const id = parts[0];
    if (seen.has(id)) continue;
    seen.add(id);

    const rawPhase = parts[2].toLowerCase();
    const phase: PdcaPhase = (["plan", "do", "check", "act"].includes(rawPhase)
      ? rawPhase
      : "do") as PdcaPhase;

    rows.push({
      id,
      codPdca: parts[1],
      phase,
      acao: parts[3] ?? "",
      subacao: parts[4] ?? "",
      responsavel: parts[7] ?? "",
      comoFazer: parts[8] ?? "",
      evidencias: parts[10] ?? "",
      indicador: parts[11] ?? "",
      meta: parts[12] ?? "",
      resultado: parts[13] ?? "",
      status: normalizeStatus(parts[14] ?? ""),
      dataFim: parts[16] ?? parts[15] ?? "",
    });
  }
  return rows;
}

// ── Build PdcaRecord ────────────────────────────────────────────────────────

function buildRecord(rows: RawRow[], filename: string): PdcaRecord {
  const codPdca = rows[0]?.codPdca ?? filename.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 7);
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
    const action = actionMap.get(key)!;
    const sub: PdcaSubaction = {
      id: row.id,
      nome: row.subacao || row.acao,
      resp: row.responsavel,
      gut: 0,
      indicador: row.indicador,
      meta: row.meta,
      resultado: row.resultado,
      status: row.status,
      ...(row.comoFazer  ? { comoFazer:    row.comoFazer  } : {}),
      ...(row.dataFim    ? { prazo:         row.dataFim    } : {}),
      ...(row.evidencias ? { evidenciaSgq:  row.evidencias } : {}),
    };
    action.subacoes.push(sub);
  }

  const allStatuses = rows.map((r) => r.status);
  const overallStatus = allStatuses.every((s) => s.includes("Concluí"))
    ? "Concluído"
    : allStatuses.some((s) => s === "Em Andamento")
    ? "Em Execução"
    : "Pendente";

  return {
    id: codPdca,
    titulo: filename.replace(/\.docx$/i, "").replace(/^📘\s*/, "").trim(),
    area: "",
    situacao: overallStatus,
    causas: "",
    analise_gut: { g: 0, u: 0, t: 0, total: 0 },
    fases,
    status: overallStatus,
    fonteArquivo: filename,
    atualizadoEm: new Date().toISOString(),
  };
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, message: "Nenhum arquivo enviado." }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      return NextResponse.json({ ok: false, message: "Somente arquivos .docx são aceitos." }, { status: 400 });
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const xml = await extractDocumentXml(buf);
    const text = xmlToText(xml);
    const rows = parseRows(text);

    if (!rows.length) {
      return NextResponse.json(
        { ok: false, message: "Nenhuma linha PDCA encontrada. Verifique se o arquivo segue o formato TABELA MESTRE." },
        { status: 422 },
      );
    }

    const record = buildRecord(rows, file.name);
    return NextResponse.json({ ok: true, pdca: record, rowCount: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao processar DOCX.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
