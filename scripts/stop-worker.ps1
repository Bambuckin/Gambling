param()

$ErrorActionPreference = "Stop"

Write-Host "[stop-worker] looking for terminal worker processes..."

$stopped = $false

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$workerDir = Join-Path $root "apps/terminal-worker"
$normalizedWorkerDir = [System.IO.Path]::GetFullPath($workerDir).TrimEnd("\")

$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
foreach ($proc in $nodeProcesses) {
  try {
    $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
    if (-not $cmdLine) { continue }
    if ($cmdLine.Contains("terminal-worker") -or $cmdLine.Contains("terminal-worker.cjs")) {
      Write-Host "[stop-worker] stopping worker pid=$($proc.Id)"
      Stop-Process -Id $proc.Id -Force
      $stopped = $true
    }
  } catch { continue }
}

if ($stopped) {
  Start-Sleep -Milliseconds 500
  Write-Host "[stop-worker] terminal worker stopped"
} else {
  Write-Host "[stop-worker] no terminal worker found"
}
