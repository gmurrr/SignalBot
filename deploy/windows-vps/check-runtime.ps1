[CmdletBinding()]
param(
    [int]$FrontendPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$RuntimeDir = Join-Path $PSScriptRoot "runtime"
$BackendLog = Join-Path $RepoRoot "backend\logs\bot.log"
$ShadowCsv = Join-Path $RepoRoot "backend\shadow_results.csv"

Write-Host "Frontend port check:"
try {
    $frontend = Test-NetConnection -ComputerName "127.0.0.1" -Port $FrontendPort -WarningAction SilentlyContinue
    Write-Host "  Port $FrontendPort reachable: $($frontend.TcpTestSucceeded)"
}
catch {
    Write-Host "  Port check failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Latest runtime transcripts:"
if (Test-Path $RuntimeDir) {
    Get-ChildItem $RuntimeDir -File | Sort-Object LastWriteTime -Descending | Select-Object -First 6 LastWriteTime, Name
}
else {
    Write-Host "  No runtime directory yet."
}

Write-Host ""
Write-Host "Backend bot.log tail:"
if (Test-Path $BackendLog) {
    Get-Content $BackendLog -Tail 15
}
else {
    Write-Host "  No backend log yet."
}

Write-Host ""
Write-Host "Shadow results present:"
Write-Host "  $ShadowCsv => $(Test-Path $ShadowCsv)"
