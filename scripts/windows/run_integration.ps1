<#
.SYNOPSIS
    Compila o jogo Paçoca para Web, serve o backend local, abre o navegador
    e inicia o servidor de pré-visualização integrado no Windows.

.DESCRIPTION
    Esse script facilita os testes integrados locais realizando o fluxo completo:
    1. Compila o jogo usando o script export_web.ps1.
    2. Instala dependências do backend se necessário e inicializa o banco de dados D1 local.
    3. Inicia o backend (Wrangler dev) em uma nova janela de terminal.
    4. Abre o navegador padrão em http://localhost:8000.
    5. Inicia o servidor de preview local (que proxyia as chamadas de /api/* para o backend).

.PARAMETER Port
    Porta do servidor de pré-visualização (padrão: 8000).

.PARAMETER Godot
    Caminho para o executável ou pasta do Godot (passado para o export_web.ps1).

.EXAMPLE
    .\scripts\windows\run_integration.ps1
#>
[CmdletBinding()]
param(
    [int]$Port = 8000,
    [string]$Godot = $(if ($env:GODOT) { $env:GODOT } else { "godot" })
)
$ErrorActionPreference = "Stop"

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

# 1. Compilar o jogo Web
Write-Host "`n>>> 1. Compilando o jogo para Web..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot "export_web.ps1") -Godot $Godot
if ($LASTEXITCODE -ne 0) {
    Write-Error "A exportação do jogo para Web falhou."
    exit $LASTEXITCODE
}

# 2. Configurar dependências do backend e banco local D1
Write-Host "`n>>> 2. Verificando dependências do backend..." -ForegroundColor Cyan
$BackendDir = Join-Path $Root "backend"
Push-Location $BackendDir
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "node_modules não encontrado no backend. Executando npm install..." -ForegroundColor Yellow
        & npm install
    }

    Write-Host "Inicializando banco de dados D1 local..." -ForegroundColor Cyan
    & npm run db:local
} finally {
    Pop-Location
}

# 3. Iniciar o backend em um terminal separado
Write-Host "`n>>> 3. Iniciando o servidor de backend (Wrangler dev) em um terminal separado..." -ForegroundColor Cyan
$WranglerProcess = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BackendDir'; npm run dev" -PassThru

# Espera alguns segundos para o Wrangler inicializar
Write-Host "Aguardando inicialização do Wrangler..." -ForegroundColor Gray
Start-Sleep -Seconds 4

# 4. Abrir o navegador na porta 8000
Write-Host "`n>>> 4. Abrindo o navegador padrão em http://localhost:$Port ..." -ForegroundColor Cyan
Start-Process "http://localhost:$Port"

# 5. Iniciar o servidor de preview (esta janela ficará bloqueada servindo o conteúdo)
Write-Host "`n>>> 5. Iniciar servidor de pré-visualização integrado..." -ForegroundColor Cyan
Write-Host "Pressione Ctrl+C nesta janela para parar os servidores e finalizar." -ForegroundColor Yellow

try {
    & (Join-Path $PSScriptRoot "preview.ps1") -Port $Port
} finally {
    if ($WranglerProcess) {
        Write-Host "`nFechando terminal do Wrangler backend..." -ForegroundColor Yellow
        Stop-Process -Id $WranglerProcess.Id -Force -ErrorAction SilentlyContinue
    }
}
