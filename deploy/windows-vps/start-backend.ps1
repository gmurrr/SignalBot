[CmdletBinding()]
param(
    [ValidateSet("SHADOW", "PROD", "BACKTEST")]
    [string]$Mode = "SHADOW"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$BackendDir = Join-Path $RepoRoot "backend"
$RuntimeDir = Join-Path $PSScriptRoot "runtime"
$PythonExe = Join-Path $RepoRoot "venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    throw "Python virtualenv not found. Run deploy\\windows-vps\\bootstrap-vps.ps1 first."
}
if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
    throw "Missing backend\\.env. Copy backend\\.env.example and fill the values first."
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$transcriptPath = Join-Path $RuntimeDir "backend-$Mode-$timestamp.log"

Start-Transcript -Path $transcriptPath -Append | Out-Null
try {
    Push-Location $BackendDir
    try {
        $env:APP_MODE = $Mode
        $env:PYTHONUNBUFFERED = "1"
        & $PythonExe -m src.main
    }
    finally {
        Pop-Location
    }
}
finally {
    Stop-Transcript | Out-Null
}
