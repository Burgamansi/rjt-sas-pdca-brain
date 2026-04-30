/**
 * Interface que define a estrutura de uma tarefa dentro do sistema PDCA.
 */
export interface TarefaPDCA {
  titulo: string;
  responsavel: string;
  status: string;
}

/**
 * Função principal para analisar documentos (PDF ou Word) da União Bag.
 * @param textoBruto - O texto extraído do arquivo original.
 * @returns Um array de objetos formatados como TarefaPDCA.
 */
export const analisarDocumentoUniaoBag = (textoBruto: string): TarefaPDCA[] => {
  // Passo 1: Documentação e Limpeza
  // O split('\n') divide o texto em linhas para que possamos analisar uma a uma.
  // O filter(l => l.length > 0) remove linhas vazias que podem causar erros.
  const linhas = textoBruto.split('\n')
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0);

  const tarefasEncontradas: TarefaPDCA[] = [];

  // Passo 2: Lógica de Mapeamento
  // Percorremos cada linha em busca de padrões de texto.
  linhas.forEach((linha) => {
    
    // Identificando uma nova Ação ou Atividade
    // Usamos toLowerCase() para que a busca não diferencie maiúsculas de minúsculas.
    if (linha.toLowerCase().includes("ação:") || linha.toLowerCase().includes("atividade:")) {
      const tituloLimpo = linha.split(':')[1]?.trim() || "Título não encontrado";
      
      tarefasEncontradas.push({
        titulo: tituloLimpo,
        responsavel: "Pendente de Identificação",
        status: "Aguardando"
      });
    }

    // Identificando o Responsável pela última ação encontrada
    if (linha.toLowerCase().includes("responsável:") && tarefasEncontradas.length > 0) {
      const ultimoIndex = tarefasEncontradas.length - 1;
      const nomeResponsavel = linha.split(':')[1]?.trim() || "Não informado";
      
      tarefasEncontradas[ultimoIndex].responsavel = nomeResponsavel;
    }
  });

  // Passo 3: Validação de Segurança
  // Se nenhuma tarefa foi encontrada, retornamos um erro amigável via console ou log.
  if (tarefasEncontradas.length === 0) {
    console.warn("Aviso: O formato do documento pode ter mudado. Nenhuma tarefa mapeada.");
  }

  return tarefasEncontradas;
};
