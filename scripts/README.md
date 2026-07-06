# scripts/

Build, preview e deploy da plataforma Paçoca, organizados por sistema
operacional. Cada tarefa tem duas variantes equivalentes — **Bash (`.sh`)** para
macOS/Linux e **PowerShell (`.ps1`)** para Windows — para que o mesmo fluxo rode
nos dois ambientes.

```
scripts/
├── preview_server.py   # servidor HTTP de preview (compartilhado pelos dois SOs)
├── unix/               # macOS / Linux (bash)
│   ├── export_web.sh   # exporta o jogo Godot -> build/web/
│   ├── preview.sh      # monta e serve tudo em uma origem (:8000)
│   ├── build_dist.sh   # monta o bundle de deploy -> build/dist/
│   └── deploy_r2.sh    # sobe build/dist/ pro bucket R2 (remoto ou local)
└── windows/            # Windows (PowerShell)
    ├── export_web.ps1
    ├── preview.ps1
    ├── build_dist.ps1
    └── deploy_r2.ps1
```

Rode sempre **a partir da raiz do repositório**. Os scripts descobrem a raiz pelo
próprio caminho, então também funcionam se chamados de outro diretório.

## Tarefas

| Tarefa | macOS / Linux | Windows |
| --- | --- | --- |
| Exportar o jogo (WASM) | `GODOT=/path/to/Godot ./scripts/unix/export_web.sh` | `.\scripts\windows\export_web.ps1 -Godot C:\path\to\Godot.exe` |
| Preview local (`:8000`) | `./scripts/unix/preview.sh` | `.\scripts\windows\preview.ps1` |
| Montar bundle de deploy | `./scripts/unix/build_dist.sh` | `.\scripts\windows\build_dist.ps1` |
| Subir pro R2 | `./scripts/unix/deploy_r2.sh` | `.\scripts\windows\deploy_r2.ps1` |

Opções equivalentes (env var no Bash ↔ parâmetro no PowerShell):

| Bash | PowerShell |
| --- | --- |
| `GODOT=...` | `-Godot ...` |
| `./preview.sh 9000` · `API=... ./preview.sh` | `-Port 9000` · `-Api ...` |
| `./deploy_r2.sh my-bucket` | `-Bucket my-bucket` |
| `SKIP_BUILD=1 ./deploy_r2.sh` | `-SkipBuild` |
| `LOCAL=1 ./deploy_r2.sh` | `-Local` |

## Pré-requisitos

- **Godot 4.7+ standard** (não Mono) + templates de export Web — para
  `export_web`.
- **Python 3** na PATH (`python`, `py` ou `python3`) — para `preview`.
- **Node 18+** e `npx wrangler` autenticado — para `deploy_r2` e o backend.

## Notas por plataforma

- **PowerShell**: se a execução de scripts estiver bloqueada, rode uma vez
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, ou invoque com
  `powershell -ExecutionPolicy Bypass -File .\scripts\windows\preview.ps1`.
- **preview**: o `.sh` monta `play/` e `editor/` com *symlinks*; o `.ps1` usa
  *junctions* de diretório (não exigem admin/Developer Mode). Ambos servem via
  `scripts/preview_server.py`, que encaminha `/api/*` pro Worker local e envia os
  headers de cross-origin isolation exigidos pelo build multi-thread do jogo.

Runbook completo (build, dev local, deploy Cloudflare, troubleshooting):
[`docs/build_and_deploy.md`](../docs/build_and_deploy.md).
