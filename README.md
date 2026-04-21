# RJT SAS PDCA Brain

Base do projeto para usar **Excel como motor de dados** com arquitetura:

- GitHub (versionamento)
- Vercel (deploy)
- Supabase (cerebro persistente)

## 1. Requisitos

- Node.js 20+
- Projeto Supabase ativo

## 2. Banco (Supabase)

1. No Supabase SQL Editor, execute:
   - `supabase/migrations/20260420_create_pdca_brain.sql`
2. Crie `.env.local` com base em `.env.example`:

```bash
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

## 3. Rodar local

```bash
npm install
npm run dev
```

Acesse: `http://localhost:3000`

## 4. Fluxo de uso

1. Clique em **Importar Excel**
2. Selecione 1 ou varios arquivos `.xlsx` (como os 7 PDCAs)
3. O app:
   - parseia cada planilha
   - converte para estrutura PDCA padronizada
   - faz upsert no Supabase (`pdca_brain`)
4. O painel recarrega com dados atualizados.

## 5. Deploy no Vercel

1. Suba o repo para GitHub.
2. Importe o repo no Vercel.
3. Configure as env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy.

## 6. Observacoes importantes

- O parser aceita variacoes de cabecalho (`fase`, `acao`, `subacao`, `responsavel`, `gut`, etc.).
- `pdca_id` e `titulo` sao inferidos principalmente pelo nome do arquivo.
- Registros com mesmo `pdca_id` sao atualizados (upsert), ideal para uploads por revisao.
