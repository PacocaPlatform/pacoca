# Build e Deploy — Paçoca

Guia operacional: como exportar o jogo, rodar a plataforma localmente e publicar
online no Cloudflare. Todos os comandos são executados **a partir da raiz do
repositório**, salvo indicação.

## Visão geral

A plataforma web tem **três peças estáticas + um backend**, servidas na **mesma
origem**:

| Fonte no repo | Servido em | O que é |
| --- | --- | --- |
| `site/` | `/` | landing page |
| `build/web/` | `/play/` | jogo exportado em WebAssembly |
| `tools/map_editor/` | `/editor/` | editor de fases |
| `backend/` (Worker + D1 + R2) | `/api/*` e o resto | API da comunidade **e** host estático |

Por que mesma origem: os links são relativos e o botão **Testar** do editor passa
a fase pro jogo via `localStorage` (só compartilhado entre `/editor/` e `/play/`
no mesmo domínio); o `/api` também é chamado same-origin.

Scripts principais (raiz):

| Script | Faz |
| --- | --- |
| `tools/export_web.sh` | exporta o jogo Godot → `build/web/` |
| `preview.sh` | monta e serve tudo localmente em uma origem (`:8000`) |
| `build_dist.sh` | monta o bundle de deploy (cópias reais) → `build/dist/` |
| `deploy_r2.sh` | sobe `build/dist/` pro bucket R2 (remoto ou local) |

---

## 1. Pré-requisitos

### Godot

- **Godot 4.6+ edição padrão (standard), NÃO a Mono/.NET.** A edição Mono **não
  exporta para Web**. O projeto é GDScript puro, então a standard basta.
- App standard no macOS: `/Applications/Godot.app` → binário em
  `/Applications/Godot.app/Contents/MacOS/Godot`.
- **Templates de export Web** (obrigatórios pra exportar). No editor:
  *Editor → Manage Export Templates → Download and Install*. Ou baixe o
  `.tpz` da versão correspondente e extraia em
  `~/Library/Application Support/Godot/export_templates/<versao>/`
  (ex.: `4.7.stable/`). Sem eles, o export falha.

### Node (para o backend Cloudflare)

- Node 18+ e npm. As dependências do Worker ficam em `backend/`:
  ```bash
  cd backend && npm install
  ```

---

## 2. Build do jogo (WebAssembly)

Exporta o Godot para `build/web/` (index.html, index.wasm, index.pck, …):

```bash
GODOT=/Applications/Godot.app/Contents/MacOS/Godot ./tools/export_web.sh
```

- O preset "Web" (`src/export_presets.cfg`) é **single-thread**, então o build
  roda em qualquer host estático, sem headers COOP/COEP.
- Refaça esse export **sempre que mudar o jogo** (`src/**/*.gd`, cenas, assets).
  `preview.sh` e `build_dist.sh` apenas reaproveitam o último `build/web/`; eles
  **não** recompilam o jogo a partir do fonte.

> O `build/web/` é gerado e fica no `.gitignore` (é grande, ~180MB).

---

## 3. Rodar localmente

Há dois modos, conforme o que você quer exercitar.

### Modo A — só site/jogo/editor (rápido, o dia a dia)

```bash
./preview.sh                 # http://localhost:8000
```

Monta `/`, `/play/` e `/editor/` numa origem só e serve estático. Recarregar o
navegador já reflete mudanças na **landing** e no **editor**. Mudanças no **jogo**
exigem re-exportar (passo 2).

Neste modo o `/api` é **encaminhado** para um Worker local (veja Modo B). Sem o
Worker rodando, **Testar/Jogar/desenhar funcionam**, mas **Publicar** e a lista
"Fases da comunidade" ficam indisponíveis (dependem do `/api`).

### Modo B — stack completa (site + API), igual à produção

Precisa do backend rodando para `/api` responder. Dois terminais:

```bash
# terminal 1 — a API (Worker + D1 local)
cd backend
npm install                  # 1x
npm run types                # 1x (gera worker-configuration.d.ts)
npm run db:local             # cria as tabelas no D1 local  ← passo fácil de esquecer
npm run dev                  # Worker/API em http://localhost:8787
```

```bash
# terminal 2 — o site (proxy de /api -> :8787)
./preview.sh                 # http://localhost:8000
```

Abra **http://localhost:8000**. O `preview.sh` serve os estáticos e repassa
`/api/*` para o Worker em `:8787`, então **Publicar** grava no D1 local. Backend
em outra porta? `API=http://localhost:8799 ./preview.sh`.

> Alternativa: servir o site pelo próprio Worker (como em produção). Aí é preciso
> semear o R2 **local**: `LOCAL=1 ./deploy_r2.sh` e depois `cd backend && npm run
> dev` → tudo em `:8787`. Isso re-sobe o `.pck` de ~137MB toda vez, então para só
> visualizar prefira o Modo A.

---

## 4. Publicar online no Cloudflare

### Por que não usar Cloudflare Pages direto

O **Pages** (e o Workers *Static Assets*) recusa arquivos acima de **25 MiB**. O
jogo tem `index.pck` (~137MB) e `index.wasm` (~38MB) acima disso. Por isso os
estáticos são servidos de um **bucket R2** (sem limite por arquivo) por um único
**Worker**, que também responde o `/api` do **D1** — tudo em uma origem.

### Setup (uma vez)

```bash
npx wrangler login

cd backend
# Banco (D1)
npx wrangler d1 create pacoca-levels     # copie o database_id para wrangler.jsonc
npm run db:remote                        # aplica schema.sql no D1 remoto
# Bucket de estáticos (R2)
npx wrangler r2 bucket create pacoca-site
cd ..
```

### Deploy (a cada release)

```bash
# 1. Exporte o jogo (se mudou)
GODOT=/Applications/Godot.app/Contents/MacOS/Godot ./tools/export_web.sh

# 2. Monte o bundle e suba para o R2
./deploy_r2.sh                           # roda build_dist.sh e envia build/dist/ -> R2

# 3. Publique o Worker (serve /api do D1 e o resto do R2)
(cd backend && npm run deploy)
```

Depois disso o site responde no subdomínio `*.workers.dev` do Worker.

### Domínio próprio

Para servir em `seudominio.com`, adicione uma rota de **custom domain** — no
dashboard do Cloudflare ou em `backend/wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "seudominio.com", "custom_domain": true }]
```

Aí `/`, `/play/`, `/editor/` e `/api/*` ficam todos nesse domínio (mesma origem).

### O que reenviar quando muda

| Mudou… | Rode |
| --- | --- |
| landing / editor (arquivos estáticos) | `./deploy_r2.sh` |
| jogo (GDScript, cenas, assets) | `./tools/export_web.sh` **depois** `./deploy_r2.sh` |
| lógica do Worker (`backend/src/`) | `(cd backend && npm run deploy)` |
| schema do banco (`backend/schema.sql`) | `(cd backend && npm run db:remote)` |

---

## 5. Troubleshooting

| Sintoma | Causa | Correção |
| --- | --- | --- |
| Export falha / sem botão "Web" | templates de export Web ausentes ou edição **Mono** | instale os templates; use a Godot **standard** |
| `wrangler dev`: `GET / → 404` | R2 **local** vazio (nada pra servir em `/`) | use `./preview.sh` para o site; ou semeie o R2 local: `LOCAL=1 ./deploy_r2.sh` |
| `GET /api/levels → 500` · `D1_ERROR: no such table: levels` | D1 **local** sem tabelas | `cd backend && npm run db:local` (funciona sem reiniciar o `dev`) |
| Publicar → `501 Unsupported method ('POST')` | `preview.sh` sozinho é estático, não tem `/api` | suba o Worker (Modo B) — o `preview.sh` passa a repassar o `/api` |
| Publicar no site → "API offline em …" | Worker (`:8787`) não está rodando | `cd backend && npm run dev` |
| Deploy no Pages recusa arquivo > 25 MiB | limite de 25 MiB por arquivo | use o Worker + R2 (seção 4), não o Pages |
| Jogo no `/play/` desatualizado | `build/web/` é o último export | re-exporte: `./tools/export_web.sh` |

---

## Referências

- Layout do site: [`site/README.md`](../site/README.md)
- Backend (API + host): [`backend/README.md`](../backend/README.md)
- Editor de fases: [`tools/map_editor/README.md`](../tools/map_editor/README.md)
- Sintaxe de mapas: [`docs/map_syntax.md`](./map_syntax.md)
