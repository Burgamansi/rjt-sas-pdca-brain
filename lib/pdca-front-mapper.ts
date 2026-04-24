import { PdcaAction, PdcaPhase, PdcaRecord, PdcaSubaction } from "@/lib/types";

type AnyObject = Record<string, unknown>;

export type PdcaGridRow = {
  etapa: PdcaAction["etapa"];
  phase: PdcaPhase;
  acao: string;
  subacao: string;
  responsavel: string;
  resultado: string;
  status: string;
  prazo: string;
};

export type PdcaPhaseGroup = {
  phase: PdcaPhase;
  etapa: PdcaAction["etapa"];
  rows: PdcaGridRow[];
};

const phaseOrder: PdcaPhase[] = ["plan", "do", "check", "act"];

const phaseAliases: Record<PdcaPhase, string[]> = {
  plan: ["plan", "PLAN", "Plan", "p", "P"],
  do: ["do", "DO", "Do", "d", "D"],
  check: ["check", "CHECK", "Check", "c", "C"],
  act: ["act", "ACT", "Act", "a", "A"],
};

function asObject(value: unknown): AnyObject | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AnyObject;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, fallback = ""): string {
  const raw = String(value ?? "").trim();
  return raw || fallback;
}

function number(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function phaseLabel(phase: PdcaPhase): PdcaAction["etapa"] {
  if (phase === "plan") return "PLAN";
  if (phase === "do") return "DO";
  if (phase === "check") return "CHECK";
  return "ACT";
}

function phaseBucket(source: AnyObject, phase: PdcaPhase): unknown[] {
  for (const alias of phaseAliases[phase]) {
    const bucket = source[alias];
    if (Array.isArray(bucket)) return bucket;
    const bucketObj = asObject(bucket);
    if (!bucketObj) continue;
    const nested = bucketObj.acoes ?? bucketObj.actions;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

function subactionsFromAction(source: AnyObject): unknown[] {
  const direct = source.subacoes ?? source.subActions ?? source.subactions;
  if (Array.isArray(direct)) return direct;

  const single = source.subacao ?? source.subAction ?? source.subaction;
  if (single) return [single];

  return [];
}

function normalizeSubaction(source: unknown, phase: PdcaPhase, subIndex: number): PdcaSubaction {
  const item = asObject(source);
  if (!item) {
    const value = text(source, "Subacao");
    return {
      id: `S${phaseLabel(phase).charAt(0)}.${subIndex + 1}`,
      nome: value,
      resp: "Nao definido",
      gut: 0,
      indicador: "Sem indicador",
      meta: "",
      resultado: "",
      status: "Em andamento",
    };
  }

  return {
    id: text(item.id ?? item.subActionId ?? item.subactionId, `S${phaseLabel(phase).charAt(0)}.${subIndex + 1}`),
    nome: text(item.nome ?? item.subacao ?? item.subAction ?? item.subaction ?? item.name, "Subacao"),
    resp: text(item.resp ?? item.responsavel ?? item.owner, "Nao definido"),
    gut: number(item.gut, 0),
    indicador: text(item.indicador ?? item.kpi ?? item.metric, "Sem indicador"),
    meta: text(item.meta ?? item.prazo ?? item.deadline ?? item.dueDate, ""),
    resultado: text(item.resultado ?? item.result ?? item.evidencia ?? item.evidence, ""),
    status: text(item.status ?? item.situacao ?? item.state, "Em andamento"),
  };
}

function normalizeAction(source: unknown, phase: PdcaPhase, actionIndex: number): PdcaAction {
  const item = asObject(source);
  if (!item) {
    return {
      id: `${phaseLabel(phase).charAt(0)}${actionIndex + 1}`,
      etapa: phaseLabel(phase),
      acao: text(source, `Acao ${phaseLabel(phase)}`),
      subacoes: [],
    };
  }

  const subactions = subactionsFromAction(item).map((subaction, index) => normalizeSubaction(subaction, phase, index));

  return {
    id: text(item.id ?? item.actionId, `${phaseLabel(phase).charAt(0)}${actionIndex + 1}`),
    etapa: phaseLabel(phase),
    acao: text(item.acao ?? item.action ?? item.nome ?? item.title, `Acao ${phaseLabel(phase)}`),
    subacoes: subactions,
  };
}

function normalizePdca(source: unknown, index: number): PdcaRecord {
  const item = asObject(source) ?? {};
  const gut = asObject(item.analise_gut ?? item.analiseGut) ?? {};
  const phaseSource = asObject(item.fases ?? item.phases) ?? {};

  const normalizedPhases = phaseOrder.reduce<Record<PdcaPhase, PdcaAction[]>>(
    (acc, phase) => {
      const actions = phaseBucket(phaseSource, phase);
      acc[phase] = actions.map((action, actionIndex) => normalizeAction(action, phase, actionIndex));
      return acc;
    },
    { plan: [], do: [], check: [], act: [] }
  );

  return {
    id: text(item.id ?? item.pdca_id ?? item.pdcaId, String(index + 1).padStart(2, "0")),
    titulo: text(item.titulo ?? item.title, `PDCA ${index + 1}`),
    area: text(item.area, "A definir"),
    situacao: text(item.situacao ?? item.situation, ""),
    causas: text(item.causas ?? item.rootCause, ""),
    analise_gut: {
      g: number(gut.g, 0),
      u: number(gut.u, 0),
      t: number(gut.t, 0),
      total: number(gut.total ?? item.gut_total ?? item.gutTotal, 0),
    },
    fases: normalizedPhases,
    status: text(item.status, "Em andamento"),
    fonteArquivo: text(item.fonteArquivo ?? item.fonte_arquivo ?? item.sourceFile, ""),
    atualizadoEm: text(item.atualizadoEm ?? item.atualizado_em ?? item.updatedAt, new Date().toISOString()),
  };
}

export function mapApiPdcas(payload: unknown): PdcaRecord[] {
  const list = asArray(payload);
  return list.map((pdca, index) => normalizePdca(pdca, index));
}

export function mapPdcaToGridRows(pdca: PdcaRecord): PdcaGridRow[] {
  const rows: PdcaGridRow[] = [];

  for (const phase of phaseOrder) {
    for (const action of pdca.fases[phase] ?? []) {
      for (const subaction of action.subacoes ?? []) {
        rows.push({
          etapa: action.etapa,
          phase,
          acao: action.acao,
          subacao: subaction.nome,
          responsavel: subaction.resp,
          resultado: subaction.resultado,
          status: subaction.status,
          prazo: subaction.meta,
        });
      }
    }
  }

  return rows;
}

export function groupByPhase(rows: PdcaGridRow[]): PdcaPhaseGroup[] {
  const grouped = new Map<PdcaPhase, PdcaGridRow[]>();

  for (const phase of phaseOrder) {
    grouped.set(phase, []);
  }

  for (const row of rows) {
    const bucket = grouped.get(row.phase);
    if (bucket) {
      bucket.push(row);
    }
  }

  return phaseOrder
    .map((phase) => ({
      phase,
      etapa: phaseLabel(phase),
      rows: grouped.get(phase) ?? [],
    }))
    .filter((group) => group.rows.length > 0);
}
