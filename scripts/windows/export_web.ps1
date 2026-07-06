<#
.SYNOPSIS
    Exports the Paçoca game to a static web build in build/web/ (Windows).

.DESCRIPTION
    Windows equivalent of scripts/unix/export_web.sh.

    Requires the STANDARD (non-Mono) Godot 4.7 editor and the matching web
    export templates installed (the Mono edition cannot export to Web). Point
    -Godot (or the GODOT env var) at the standard editor binary, or put it on
    PATH as `godot`.

    The Web preset (game/export_presets.cfg) is multi-threaded (thread_support=true)
    so Godot runs the audio mixer off the main thread (smooth music). This REQUIRES
    the host to send cross-origin-isolation headers so SharedArrayBuffer is
    available (Cross-Origin-Opener-Policy: same-origin +
    Cross-Origin-Embedder-Policy: require-corp). The Worker sets these for the
    play/ path (backend/src/index.ts, serveStatic).

.EXAMPLE
    .\scripts\windows\export_web.ps1 -Godot "C:\Godot\Godot_v4.7-stable_win64_console.exe"

.EXAMPLE
    $env:GODOT = "C:\Godot\Godot_v4.7-stable_win64_console.exe"
    .\scripts\windows\export_web.ps1
#>
[CmdletBinding()]
param(
    [string]$Godot = $(if ($env:GODOT) { $env:GODOT } else { "godot" })
)
$ErrorActionPreference = "Stop"

# Allow -Godot / $env:GODOT to point at the extracted Godot folder, not just the
# .exe: resolve a directory to the editor binary inside it (prefer the console
# build so --headless output reaches this script's stdout).
if (Test-Path $Godot -PathType Container) {
    $exe = Get-ChildItem -Path $Godot -Filter "Godot*_console.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $exe) { $exe = Get-ChildItem -Path $Godot -Filter "Godot*.exe" -File -ErrorAction SilentlyContinue | Select-Object -First 1 }
    if (-not $exe) { throw "GODOT points to directory '$Godot' but no Godot*.exe was found inside it." }
    $Godot = $exe.FullName
}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Project = Join-Path $Root "game"
$Out = Join-Path $Root "build\web"

New-Item -ItemType Directory -Force -Path $Out | Out-Null
Write-Host "Exporting Web build -> $Out"
& $Godot --headless --path $Project --import
if ($LASTEXITCODE -ne 0) { throw "Godot --import failed (exit $LASTEXITCODE). Is '$Godot' the standard, non-Mono editor?" }
& $Godot --headless --path $Project --export-release "Web" (Join-Path $Out "index.html")
if ($LASTEXITCODE -ne 0) { throw "Godot --export-release failed (exit $LASTEXITCODE). Are the Web export templates installed?" }
Write-Host "Done. Serve locally with:  python -m http.server 8777 --directory build/web"
