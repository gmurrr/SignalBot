[CmdletBinding()]
param(
    [int]$Port = 3000,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$FrontendDir = Join-Path $RepoRoot "frontend"
$RuntimeDir = Join-Path $PSScriptRoot "runtime"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm not found. Install Node.js first."
}
if (-not (Test-Path (Join-Path $FrontendDir ".env.local"))) {
    throw "Missing frontend\\.env.local. Copy frontend\\.env.local.example and fill the values first."
}

New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$transcriptPath = Join-Path $RuntimeDir "frontend-$Port-$timestamp.log"

Start-Transcript -Path $transcriptPath -Append | Out-Null
try {
    Push-Location $FrontendDir
    try {
        if (-not $SkipBuild) {
            npm run build
        }
        $env:PORT = "$Port"
        npm run start
    }
    finally {
        Pop-Location
    }
}
finally {
    Stop-Transcript | Out-Null
}
