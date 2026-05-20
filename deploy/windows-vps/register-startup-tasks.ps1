[CmdletBinding()]
param(
    [ValidateSet("SHADOW", "PROD")]
    [string]$BackendMode = "SHADOW",
    [int]$FrontendPort = 3000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$BackendScript = (Resolve-Path (Join-Path $PSScriptRoot "start-backend.ps1")).Path
$FrontendScript = (Resolve-Path (Join-Path $PSScriptRoot "start-frontend.ps1")).Path
$PowerShellExe = (Get-Command powershell.exe -ErrorAction Stop).Source

$BackendAction = New-ScheduledTaskAction `
    -Execute $PowerShellExe `
    -Argument "-ExecutionPolicy Bypass -File `"$BackendScript`" -Mode $BackendMode"
$FrontendAction = New-ScheduledTaskAction `
    -Execute $PowerShellExe `
    -Argument "-ExecutionPolicy Bypass -File `"$FrontendScript`" -Port $FrontendPort"

$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId $CurrentUser -LogonType InteractiveToken -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable

Register-ScheduledTask `
    -TaskName "SignalBot-Backend-$BackendMode" `
    -Action $BackendAction `
    -Trigger $Trigger `
    -Principal $Principal `
    -Settings $Settings `
    -Force | Out-Null

Register-ScheduledTask `
    -TaskName "SignalBot-Frontend" `
    -Action $FrontendAction `
    -Trigger $Trigger `
    -Principal $Principal `
    -Settings $Settings `
    -Force | Out-Null

Write-Host "Scheduled tasks registered."
Write-Host "Backend task: SignalBot-Backend-$BackendMode"
Write-Host "Frontend task: SignalBot-Frontend"
Write-Host "Note: these tasks start on user logon. For a headless VPS after reboot, configure auto-logon or start them manually."
