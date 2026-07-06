<#
.SYNOPSIS
    Assembles the production bundle to upload to a static host (Windows).

.DESCRIPTION
    Windows equivalent of scripts/unix/build_dist.sh. Combines the three static
    pieces into ONE folder (real copies, so any host works):

      build/dist/
        index.html, styles.css, app.js, assets/   <- site/        (landing)
        play/                                      <- build/web/   (WASM game)
        editor/                                    <- tools/map_editor/ (editor)

    Upload the CONTENTS of build/dist/ as the site root. The community backend
    (backend/, a Cloudflare Worker) is deployed separately and answers /api/*.

    Prereq: export the game first so build/web/ exists:
      .\scripts\windows\export_web.ps1 -Godot C:\path\to\Godot.exe

.EXAMPLE
    .\scripts\windows\build_dist.ps1
#>
[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Dist = Join-Path $Root "build\dist"

if (-not (Test-Path (Join-Path $Root "build\web"))) {
    Write-Error "build/web/ not found. Run .\scripts\windows\export_web.ps1 first."
    exit 1
}

if (Test-Path $Dist) { Remove-Item -Recurse -Force $Dist }
New-Item -ItemType Directory -Force -Path $Dist | Out-Null

# Landing at the root.
Copy-Item -Recurse -Force (Join-Path $Root "site\*") $Dist
Remove-Item -Force (Join-Path $Dist "README.md") -ErrorAction SilentlyContinue

# Game and editor as sibling folders.
Copy-Item -Recurse -Force (Join-Path $Root "build\web") (Join-Path $Dist "play")
Copy-Item -Recurse -Force (Join-Path $Root "tools\map_editor") (Join-Path $Dist "editor")
# Drop the editor's legacy/native-only bits from the web bundle.
Remove-Item -Force (Join-Path $Dist "editor\server.py") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $Dist "editor\__pycache__") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $Dist "editor\levels") -ErrorAction SilentlyContinue

Write-Host "Bundle ready:  $Dist"
Write-Host "Upload its CONTENTS as the site root. Then deploy backend/ for /api/*."
$sizeMb = [math]::Round((Get-ChildItem -Recurse -File $Dist | Measure-Object Length -Sum).Sum / 1MB, 1)
Write-Host "Total: $sizeMb MB"
