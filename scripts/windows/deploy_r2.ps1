<#
.SYNOPSIS
    Uploads the static bundle (build/dist/) to the Cloudflare R2 bucket (Windows).

.DESCRIPTION
    Windows equivalent of scripts/unix/deploy_r2.sh. Uploads to the R2 bucket the
    Worker serves from (binding ASSETS in backend/wrangler.jsonc).

    Prereqs (once):
      npx wrangler login
      npx wrangler r2 bucket create pacoca-site
      # game exported: .\scripts\windows\export_web.ps1 -Godot C:\path\to\Godot.exe

.PARAMETER Bucket
    Target bucket name (default: pacoca-site).

.PARAMETER SkipBuild
    Upload the existing build/dist/ as-is (skip build_dist.ps1).

.PARAMETER Local
    Seed the LOCAL R2 (for `wrangler dev`) instead of the remote bucket.

.EXAMPLE
    .\scripts\windows\deploy_r2.ps1                 # rebuild build/dist/ then upload to pacoca-site

.EXAMPLE
    .\scripts\windows\deploy_r2.ps1 -Local          # seed the LOCAL R2 for wrangler dev
#>
[CmdletBinding()]
param(
    [string]$Bucket = "pacoca-site",
    [switch]$SkipBuild,
    [switch]$Local
)
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Dist = Join-Path $Root "build\dist"
# wrangler r2 object put/get default to the LOCAL bucket, so target the remote
# bucket explicitly unless -Local is set (which seeds the local R2 for dev).
$LocalFlag = if ($Local) { "--local" } else { "--remote" }

if (-not $SkipBuild) {
    & (Join-Path $PSScriptRoot "build_dist.ps1")
}
if (-not (Test-Path $Dist)) {
    Write-Error "$Dist not found. Run .\scripts\windows\build_dist.ps1 first."
    exit 1
}

function Get-ContentType([string]$Path) {
    switch (([System.IO.Path]::GetExtension($Path)).TrimStart('.').ToLower()) {
        "html"  { "text/html; charset=utf-8" }
        "js"    { "text/javascript; charset=utf-8" }
        "mjs"   { "text/javascript; charset=utf-8" }
        "css"   { "text/css; charset=utf-8" }
        "json"  { "application/json; charset=utf-8" }
        "wasm"  { "application/wasm" }
        "png"   { "image/png" }
        "jpg"   { "image/jpeg" }
        "jpeg"  { "image/jpeg" }
        "gif"   { "image/gif" }
        "svg"   { "image/svg+xml" }
        "ico"   { "image/x-icon" }
        "webp"  { "image/webp" }
        "woff2" { "font/woff2" }
        "wav"   { "audio/wav" }
        "mp3"   { "audio/mpeg" }
        "ogg"   { "audio/ogg" }
        "txt"   { "text/plain; charset=utf-8" }
        default { "application/octet-stream" }
    }
}

$files = Get-ChildItem -Recurse -File $Dist
$count = $files.Count
$mode = if ($Local) { " (LOCAL)" } else { "" }
Write-Host "Uploading $count files from build/dist/ -> r2://$Bucket$mode"

$backend = Join-Path $Root "backend"
$distPrefix = $Dist.TrimEnd('\') + '\'
$i = 0
foreach ($f in $files) {
    # Key = path relative to build/dist/, with forward slashes for R2.
    $key = $f.FullName.Substring($distPrefix.Length).Replace('\', '/')
    $ct = Get-ContentType $f.FullName
    $i++
    Write-Host ("[{0,2}/{1}] {2} ({3})" -f $i, $count, $key, $ct)
    Push-Location $backend
    try {
        & npx wrangler r2 object put "$Bucket/$key" --file="$($f.FullName)" --content-type="$ct" $LocalFlag | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "wrangler upload failed for $key (exit $LASTEXITCODE)" }
    } finally {
        Pop-Location
    }
}

if ($Local) {
    Write-Host "Done (local). Run the Worker:  cd backend; npm run db:local; npm run dev"
} else {
    Write-Host "Done. Deploy the Worker to serve them:  cd backend; npm run deploy"
}
