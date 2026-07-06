<#
.SYNOPSIS
    Local preview of the whole Paçoca platform (landing + game + editor) on one
    origin (Windows).

.DESCRIPTION
    Windows equivalent of scripts/unix/preview.sh. Mirrors the production deploy
    layout so every link works:

      /          -> site/            (landing page)
      /play/     -> build/web/       (exported WASM game)
      /editor/   -> tools/map_editor/ (visual editor)
      /api/*     -> proxied to a local Worker (wrangler dev), default :8787

    Static files are served directly; /api/* is forwarded to the community
    backend so Publicar and the community feed work locally too. Export the game
    first with .\scripts\windows\export_web.ps1 so build/web/ exists.

    To make /api work, run the Worker in another terminal:
      cd backend; npm run db:local; npm run dev      # API on :8787

    The HTTP server itself is the shared scripts/preview_server.py, launched via
    Python (needs Python 3 on PATH as `python`, `py`, or `python3`).

.PARAMETER Port
    Port to listen on (default 8000).

.PARAMETER Api
    Backend base URL for /api/* (default http://localhost:8787).

.EXAMPLE
    .\scripts\windows\preview.ps1                 # http://localhost:8000

.EXAMPLE
    .\scripts\windows\preview.ps1 -Port 9000 -Api http://localhost:8799
#>
[CmdletBinding()]
param(
    [int]$Port = 8000,
    [string]$Api = "http://localhost:8787"
)
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Out = Join-Path $Root "build\preview"

# Locate a Python 3 interpreter (Windows commonly ships `py`; `python` from the
# Store; `python3` on some setups).
$python = $null
foreach ($cand in @("python", "py", "python3")) {
    if (Get-Command $cand -ErrorAction SilentlyContinue) { $python = $cand; break }
}
if (-not $python) {
    Write-Error "Python 3 not found on PATH (tried python, py, python3). Install it from https://python.org."
    exit 1
}
# `py` needs an explicit -3 to select Python 3.
$pyArgs = if ($python -eq "py") { @("-3") } else { @() }

# Assemble the sibling layout with directory junctions (rebuilt each run).
# Junctions don't require admin/Developer Mode, unlike symlinks.
if (Test-Path $Out) { Remove-Item -Recurse -Force $Out }
New-Item -ItemType Directory -Force -Path $Out | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root "site\*") $Out
New-Item -ItemType Junction -Path (Join-Path $Out "editor") -Target (Join-Path $Root "tools\map_editor") | Out-Null
if (Test-Path (Join-Path $Root "build\web")) {
    New-Item -ItemType Junction -Path (Join-Path $Out "play") -Target (Join-Path $Root "build\web") | Out-Null
} else {
    Write-Host "!  build/web/ not found — run .\scripts\windows\export_web.ps1 first (Jogar/Testar will 404)."
}

$env:PREVIEW_DIR = $Out
$env:PREVIEW_PORT = "$Port"
$env:PREVIEW_API = $Api

Write-Host "Paçoca preview em  http://localhost:$Port"
Write-Host "  /         landing"
Write-Host "  /play/    jogo (WASM)"
Write-Host "  /editor/  map editor  ->  desenhe e clique em Testar"
Write-Host "  /api/*    -> $Api  (para Publicar/comunidade: cd backend; npm run db:local; npm run dev)"

& $python @pyArgs (Join-Path $Root "scripts\preview_server.py")
