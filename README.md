# Controle AV — edição Vercel

Sistema web para cadastro, localização e movimentação de equipamentos audiovisuais.

Esta pasta foi adaptada especificamente para **Vercel**:

- Frontend: React + Vite + Tailwind CSS
- API: Express executado como Vercel Function
- Banco: PostgreSQL (recomendado: Neon pelo Marketplace do Vercel)
- Autenticação: JWT + bcrypt
- Código de barras: Code 128 / JsBarcode
- Scanner: html5-qrcode
- Relatórios: PDF, Excel e CSV no navegador
- Backup: snapshots JSON persistidos no PostgreSQL
- Interface em português do Brasil

> O SQLite da versão local foi removido desta edição porque o filesystem de funções serverless não deve ser usado como armazenamento persistente.

## Deploy rápido no Vercel

Leia `DEPLOY_VERCEL.md`. O fluxo é:

1. Subir esta pasta para um repositório GitHub.
2. Importar o repositório no Vercel.
3. Criar/conectar um banco Neon/Postgres no Vercel.
4. Definir as variáveis `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`.
5. Fazer Redeploy.

O banco é criado automaticamente na primeira requisição da API.

## Variáveis necessárias

```env
DATABASE_URL=postgresql://usuario:senha@host/database?sslmode=require
JWT_SECRET=uma-chave-aleatoria-com-pelo-menos-32-caracteres
ADMIN_EMAIL=admin@controleav.local
ADMIN_PASSWORD=uma-senha-forte-com-pelo-menos-8-caracteres
SEED_DEMO=true
CORS_ORIGIN=*
PHOTO_MAX_MB=2
```

### SEED_DEMO

- `true`: cria 20 equipamentos, um operador e movimentações de demonstração.
- `false`: cria apenas categorias básicas e o administrador configurado.

Com `SEED_DEMO=true`, o operador de demonstração é:

- E-mail: `operador@controleav.local`
- Senha: `Operador@123`

O administrador usa exatamente `ADMIN_EMAIL` e `ADMIN_PASSWORD` definidos no Vercel.

## Fotos

Nesta edição, as fotos são gravadas no PostgreSQL como Data URL, com limite configurável em `PHOTO_MAX_MB`. Para evitar respostas grandes, a listagem geral não envia as fotos; a foto completa é carregada apenas na tela de detalhe/edição do equipamento.

## Desenvolvimento local

Crie `apps/api/.env` usando `apps/api/.env.example` e depois:

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`
API: `http://localhost:3333/api/health`

## Estrutura

```text
api/index.ts                  função de entrada do Vercel
apps/api/src/                 backend Express/PostgreSQL
apps/web/src/                 frontend React
vercel.json                   build, rewrites e função serverless
.env.example                  variáveis de referência
DEPLOY_VERCEL.md              passo a passo de publicação
```
