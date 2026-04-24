import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { PdcaRecord, PdcaPhase } from "@/lib/types";

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

const DEMO_PDCAS: PdcaRecord[] = [
  {
    id: "PDCA-001",
    titulo: "Melhoria do Processo de Fabricação",
    area: "Produção",
    situacao: "85",
    causas: " gargalo na linha de montagem",
    analise_gut: { g: 9, u: 7, t: 8, total: 24 },
    fases: {
      plan: [
        {
          id: "plan-1",
          etapa: "PLAN",
          acao: "Mapear processo atual",
          subacoes: [
            { id: "sub-1", nome: "Entrevistar operadores", resp: "João Silva", gut: 9, indicador: "Nº entrevistas", meta: "10", resultado: "12", status: "Concluído" },
            { id: "sub-2", nome: "Documentar fluxo", resp: "Maria Costa", gut: 7, indicador: "Fluxo documentado", meta: "1", resultado: "1", status: "Concluído" }
          ]
        }
      ],
      do: [
        {
          id: "do-1",
          etapa: "DO",
          acao: "Implementar melhorias",
          subacoes: [
            { id: "sub-3", nome: "Treinar equipe", resp: "Pedro Santos", gut: 8, indicador: "Equipe treinada", meta: "15", resultado: "15", status: "Concluído" },
            { id: "sub-4", nome: "Ajustar layout", resp: "Ana Oliveira", gut: 6, indicador: "Layout ajustado", meta: "1", resultado: "1", status: "Em andamento" }
          ]
        }
      ],
      check: [
        {
          id: "check-1",
          etapa: "CHECK",
          acao: "Verificar resultados",
          subacoes: [
            { id: "sub-5", nome: "Medir produtividade", resp: "Carlos Lima", gut: 8, indicador: "Produtividade", meta: "+20%", resultado: "+18%", status: "Em andamento" }
          ]
        }
      ],
      act: [
        {
          id: "act-1",
          etapa: "ACT",
          acao: "Padronizar",
          subacoes: [
            { id: "sub-6", nome: "Criar procedimentos", resp: "João Silva", gut: 5, indicador: "Procedimentos", meta: "5", resultado: "", status: "Pendente" }
          ]
        }
      ]
    },
    status: "Em-andamento",
    fonteArquivo: "Demo",
    atualizadoEm: new Date().toISOString()
  },
  {
    id: "PDCA-002",
    titulo: "Redução de Custos Operacionais",
    area: "Financeiro",
    situacao: "60",
    causas: "custos elevados de matéria-prima",
    analise_gut: { g: 8, u: 9, t: 7, total: 24 },
    fases: {
      plan: [
        {
          id: "plan-2",
          etapa: "PLAN",
          acao: "Analisar custos",
          subacoes: [
            { id: "sub-7", nome: "Levantar custos", resp: "Julia Santos", gut: 9, indicador: "Custos levantados", meta: "1", resultado: "1", status: "Concluído" }
          ]
        }
      ],
      do: [
        {
          id: "do-2",
          etapa: "DO",
          acao: "Negociar fornecedores",
          subacoes: [
            { id: "sub-8", nome: "Buscar novos fornecedores", resp: "Roberto Alves", gut: 8, indicador: "Fornecedores", meta: "3", resultado: "2", status: "Em andamento" }
          ]
        }
      ],
      check: [
        {
          id: "check-2",
          etapa: "CHECK",
          acao: "Comparar propostas",
          subacoes: [
            { id: "sub-9", nome: "Analisar propostas", resp: "Julia Santos", gut: 7, indicador: "Propostas", meta: "3", resultado: "", status: "Pendente" }
          ]
        }
      ],
      act: []
    },
    status: "Em-andamento",
    fonteArquivo: "Demo",
    atualizadoEm: new Date().toISOString()
  }
];

export async function GET() {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      { ok: true, pdcas: DEMO_PDCAS, message: "Modo demo ativado - Supabase não configurado", isDemo: true },
      { status: 200 }
    );
  }
  
  const { data, error } = await supabaseAdmin
    .from("pdca_brain")
    .select("pdca_id,titulo,area,status,gut_total,fonte_arquivo,atualizado_em,payload")
    .order("pdca_id", { ascending: true });

  if (error) {
    return NextResponse.json(
      { ok: true, pdcas: DEMO_PDCAS, message: `Erro Supabase: ${error.message}. Modo demo ativado.`, isDemo: true },
      { status: 200 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { ok: true, pdcas: DEMO_PDCAS, message: "Nenhum PDCA encontrado. carregando dados de demo.", isDemo: true },
      { status: 200 }
    );
  }

  const pdcas = (data ?? []).map((row) => {
    const typed = row as PdcaBrainRow;
    return typed.payload;
  });
  return NextResponse.json({ ok: true, pdcas, isDemo: false }, { status: 200 });
}

export async function POST(request: NextRequest) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: "Supabase não configurado. Importe via Excel para usar modo local." },
      { status: 500 }
    );
  }
  let body: { pdcas?: PdcaRecord[] };
  try {
    body = (await request.json()) as { pdcas?: PdcaRecord[] };
  } catch {
    return NextResponse.json({ ok: false, message: "Body JSON inválido." }, { status: 400 });
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
      message: `${rows.length} PDCA(s) sincronizado(s) com sucesso.`,
      count: rows.length,
    },
    { status: 200 }
  );
}