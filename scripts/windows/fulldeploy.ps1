<#
.SYNOPSIS
    Runs the full workflow: exports the game, builds the static distribution bundle, and deploys it to R2 (Windows).

.DESCRIPTION
    Windows script that chains export_web.ps1, build_dist.ps1, and deploy_r2.ps1.
    All parameters are passed down to their respective scripts.

.PARAMETER Godot
    Path to the Godot editor binary or folder (passed to export_web.ps1).

.PARAMETER Bucket
    Target R2 bucket name (passed to deploy_r2.ps1).

.PARAMETER Local
    Deploys/seeds to local R2 instead of remote (passed to deploy_r2.ps1).

.PARAMETER SkipExport
    Skips exporting the Web build from Godot.

.PARAMETER SkipBuild
    Skips recreating the dist bundle and deploys the existing build/dist folder.

.EXAMPLE
    .\scripts\windows\fulldeploy.ps1 -Godot "C:\Godot\Godot_v4.7-stable_win64_console.exe"
#>
[CmdletBinding()]
param(
    [string]$Godot = $(if ($env:GODOT) { $env:GODOT } else { "godot" }),
    [string]$Bucket = "pacoca-site",
    [switch]$Local,
    [switch]$SkipExport,
    [switch]$SkipBuild
)
$ErrorActionPreference = "Stop"

Write-Host "--- Paçoca Full Deploy ---"

# 1. Export Web from Godot
if (-not $SkipExport) {
    Write-Host "Exporting Web build..."
    & (Join-Path $PSScriptRoot "export_web.ps1") -Godot $Godot
} else {
    Write-Host "Skipping Web export."
}

# 2. Deploy (which will trigger build_dist unless SkipBuild is specified)
Write-Host "Building and Deploying to R2..."
& (Join-Path $PSScriptRoot "deploy_r2.ps1") -Bucket $Bucket -Local:$Local -SkipBuild:$SkipBuild

Write-Host "Deployment Workflow Completed Successfully."