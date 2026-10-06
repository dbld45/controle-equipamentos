# Deploy correto no Vercel — Controle AV

## 1. Estrutura que o Vercel precisa enxergar

Na raiz selecionada do projeto precisam aparecer diretamente:

- `package.json`
- `vercel.json`
- pasta `api`
- pasta `apps`

Se no GitHub esses arquivos estiverem dentro de uma pasta chamada `controle-equipamentos-av-vercel-corrigido`, configure essa pasta em **Settings > Build and Deployment > Root Directory**.

Se `package.json` e `vercel.json` já aparecem na raiz do repositório, deixe **Root Directory vazio / padrão**.

## 2. Configurações de Build

Em **Settings > Build and Deployment**:

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Node.js: `22.x`

O arquivo `vercel.json` do projeto já contém essas configurações, então normalmente não é necessário sobrescrevê-las no painel.

## 3. Primeiro teste — sem banco

Depois do deploy, abra:

`https://SEU-PROJETO.vercel.app/api/ping`

Resposta esperada:

```json
{"ok":true,"service":"controle-av-vercel","vercel":true}
```

Se `/api/ping` responder, o projeto e as Functions estão sendo encontrados corretamente.

## 4. Banco PostgreSQL / Neon

Conecte um PostgreSQL (Neon é uma opção adequada) e crie no Vercel:

- `DATABASE_URL`
- `JWT_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `SEED_DEMO=true` (somente para demonstração)
- `CORS_ORIGIN=*`
- `PHOTO_MAX_MB=2`

Depois faça **Redeploy**.

## 5. Teste da API completa

Abra:

`https://SEU-PROJETO.vercel.app/api/health`

Resposta esperada:

```json
{"ok":true,"service":"controle-equipamentos-av-api","database":"postgres"}
```

## 6. Teste da interface

Abra apenas:

`https://SEU-PROJETO.vercel.app/`

A tela de login deve aparecer.

## Se aparecer 404 NOT_FOUND do Vercel

Quase sempre significa que o Vercel está usando a pasta errada como raiz.

Vá em:

**Project > Settings > Build and Deployment > Root Directory**

A pasta selecionada precisa ser exatamente aquela onde estão `package.json` e `vercel.json`.

Depois clique em **Deployments > Redeploy**.
