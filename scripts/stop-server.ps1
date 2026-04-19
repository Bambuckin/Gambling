param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

function Read-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $result = @{}
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) { return }
    $parts = $line.Split("=", 2)
    if ($parts.Length -ne 2) { return }
    $key = $parts[0].Trim()
    if ($key.Length -eq 0) { return }
    $result[$key] = $parts[1]
  }
  return $result
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile } else { Join-Path $root $EnvFile }

if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Env file not found: $envPath"
}

$envMap = Read-EnvFile -Path $envPath
$rawPort = if ($envMap.ContainsKey("PORT")) { $envMap["PORT"].Trim() } else { "3000" }
$port = 0
if (-not ([int]::TryParse($rawPort, [ref]$port) -and $port -ge 1 -and $port -le 65535)) {
  $port = 3000
}

Write-Host "[stop-server] looking for web server on port $port..."

$stopped = $false

$connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($connections) {
  foreach ($conn in $connections) {
    try {
      $proc = Get-Process -Id $conn.OwningProcess -ErrorAction Stop
      $procName = $proc.ProcessName.ToLowerInvariant()
      if ($procName -in @("node", "next")) {
        Write-Host "[stop-server] stopping $($proc.ProcessName) pid=$($proc.Id) on port $port"
        Stop-Process -Id $proc.Id -Force
        $stopped = $true
      }
    } catch { continue }
  }
}

if ($stopped) {
  Start-Sleep -Milliseconds 500
  $stillListening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($stillListening) {
    foreach ($conn in $stillListening) {
      try {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
      } catch { continue }
    }
  }
  Write-Host "[stop-server] web server stopped"
} else {
  Write-Host "[stop-server] no web server found on port $port"
}
