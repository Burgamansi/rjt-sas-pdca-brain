import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { PdcaRecord } from "@/lib/types";

type PdcaBrainRow = {
  pdca_id: string;
  titulo: string;
  area: string;
  status: string;
  gut_total: number;
  fonte_arquivo: string | null;
  atualizado_em: string;
  payload: PdcaRecord;
};

export async function GET() {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Falha de configuracao do Supabase." },
      { status: 500 }
    );
  }
  const { data, error } = await supabaseAdmin
    .from("pdca_brain")
    .select("pdca_id,titulo,area,status,gut_total,fonte_arquivo,atualizado_em,payload")
    .order("pdca_id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: false, message: `Falha ao carregar PDCAs: ${error.message}` },
      { status: 500 }
    );
  }

  const pdcas = (data ?? []).map((row) => {
    const typed = row as PdcaBrainRow;
    return typed.payload;
  });
  return NextResponse.json({ ok: true, pdcas }, { status: 200 });
}

export async function POST(request: NextRequest) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "Falha de configuracao do Supabase." },
      { status: 500 }
    );
  }
  let body: { pdcas?: PdcaRecord[] };
  try {
    body = (await request.json()) as { pdcas?: PdcaRecord[] };
  } catch {
    return NextResponse.json({ ok: false, message: "Body JSON invalido." }, { status: 400 });
  }

  const incoming = Array.isArray(body.pdcas) ? body.pdcas : [];
  if (!incoming.length) {
    return NextResponse.json({ ok: false, message: "Nenhum PDCA enviado." }, { status: 400 });
  }

  const rows: PdcaBrainRow[] = incoming.map((pdca) => ({
    pdca_id: String(pdca.id),
    titulo: pdca.titulo,
    area: pdca.area,
    status: pdca.status,
    gut_total: pdca.analise_gut.total ?? 0,
    fonte_arquivo: pdca.fonteArquivo ?? null,
    atualizado_em: pdca.atualizadoEm,
    payload: pdca,
  }));

  const { error } = await supabaseAdmin.from("pdca_brain").upsert(rows, {
    onConflict: "pdca_id",
    ignoreDuplicates: false,
  });

  if (error) {
    return NextResponse.json(
      { ok: false, message: `Falha ao salvar no Supabase: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: `${rows.length} arquivo(s) processado(s) e sincronizado(s) com o cerebro do projeto.`,
      count: rows.length,
    },
    { status: 200 }
  );
}
