export type PdcaPhase = "plan" | "do" | "check" | "act";

export type PdcaSubaction = {
  id: string;
  nome: string;
  resp: string;
  gut: number;
  indicador: string;
  meta: string;
  resultado: string;
  status: string;
};

export type PdcaAction = {
  id: string;
  etapa: "PLAN" | "DO" | "CHECK" | "ACT";
  acao: string;
  subacoes: PdcaSubaction[];
};

export type PdcaRecord = {
  id: string;
  titulo: string;
  area: string;
  situacao: string;
  causas: string;
  analise_gut: {
    g: number;
    u: number;
    t: number;
    total: number;
  };
  fases: Record<PdcaPhase, PdcaAction[]>;
  status: string;
  fonteArquivo: string;
  atualizadoEm: string;
};

export type PdcaImportResult = {
  ok: boolean;
  file: string;
  message: string;
  pdca?: PdcaRecord;
};
