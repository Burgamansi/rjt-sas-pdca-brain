/**
 * Interface atualizada para incluir o campo 'comoFazer'
 */
export interface TarefaPDCA {
  titulo: string;
  comoFazer: string; // Novo campo
  responsavel: string;
  status: string;
}

export const analisarDocumentoUniaoBag = (textoBruto: string): TarefaPDCA[] => {
  const linhas = textoBruto.split('\n')
    .map(linha => linha.trim())
    .filter(linha => linha.length > 0);

  const tarefasEncontradas: TarefaPDCA[] = [];

  linhas.forEach((linha, index) => {
    // Identifica a Ação/Atividade
    if (linha.toLowerCase().includes("ação:") || linha.toLowerCase().includes("atividade:")) {
      const tituloLimpo = linha.split(':')[1]?.trim() || "Título não encontrado";
      
      // Tenta buscar o "Como Fazer" na linha imediatamente abaixo (index + 1)
      const proximaLinha = linhas[index + 1] || "";
      let detalhamento = "—";

      // Se a próxima linha contiver termos de execução, nós a capturamos
      if (proximaLinha && !proximaLinha.toLowerCase().includes("ação:") && !proximaLinha.toLowerCase().includes("responsável:")) {
          detalhamento = proximaLinha;
      }

      tarefasEncontradas.push({
        titulo: tituloLimpo,
        comoFazer: detalhamento, // Atribui o detalhamento encontrado
        responsavel: "Pendente",
        status: "Aguardando"
      });
    }

    // Identifica o Responsável
    if (linha.toLowerCase().includes("responsável:") && tarefasEncontradas.length > 0) {
      const ultimoIndex = tarefasEncontradas.length - 1;
      tarefasEncontradas[ultimoIndex].responsavel = linha.split(':')[1]?.trim() || "Não informado";
    }
  });

  return tarefasEncontradas;
};
