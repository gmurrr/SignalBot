[CmdletBinding()]
param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend"
$VenvPython = Join-Path $RepoRoot "venv\Scripts\python.exe"

function Require-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $Name"
    }
}

function Ensure-FileFromExample([string]$TargetPath, [string]$ExamplePath) {
    if ((-not (Test-Path $TargetPath)) -and (Test-Path $ExamplePath)) {
        Copy-Item $ExamplePath $TargetPath
        Write-Host "Created $TargetPath from example file."
    }
}

Ensure-FileFromExample (Join-Path $BackendDir ".env") (Join-Path $BackendDir ".env.example")
Ensure-FileFromExample (Join-Path $FrontendDir ".env.local") (Join-Path $FrontendDir ".env.local.example")

if (-not $SkipBackend) {
    Require-Command "py"
    if (-not (Test-Path $VenvPython)) {
        & py -3.10 -m venv (Join-Path $RepoRoot "venv")
    }
    & $VenvPython -m pip install --upgrade pip
    & $VenvPython -m pip install -r (Join-Path $BackendDir "requirements.txt")
}

if (-not $SkipFrontend) {
    Require-Command "npm"
    Push-Location $FrontendDir
    try {
        npm install
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Windows VPS bootstrap complete."
Write-Host "1. Fill backend/.env and frontend/.env.local with real secrets."
Write-Host "2. Run start-backend.ps1 -Mode SHADOW to validate the bot."
Write-Host "3. Run start-frontend.ps1 to validate the website."
