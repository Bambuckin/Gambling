param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env",
  [Parameter(Mandatory = $false)]
  [switch]$ForceRestart
)

$ErrorActionPreference = "Stop"

function Resolve-WebPort {
  $rawPort = ""
  if ($null -ne $env:PORT) {
    $rawPort = [string]$env:PORT
  }
  $rawPort = $rawPort.Trim()
  if ($rawPort.Length -eq 0) {
    return 3000
  }

  $parsedPort = 0
  if ([int]::TryParse($rawPort, [ref]$parsedPort) -and $parsedPort -ge 1 -and $parsedPort -le 65535) {
    return $parsedPort
  }

  throw "invalid PORT value: $rawPort"
}

function Get-ListenerOwner {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  return Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
}

function Test-WebEndpoint {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -UseBasicParsing -TimeoutSec 3
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Read-CurrentBuildId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  return (Get-Content -LiteralPath $Path -Raw).Trim()
}

function Get-CurrentCssAssetPaths {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DirectoryPath
  )

  if (-not (Test-Path -LiteralPath $DirectoryPath)) {
    return @()
  }

  return Get-ChildItem -LiteralPath $DirectoryPath -File -Filter "*.css" |
    ForEach-Object { "/_next/static/css/$($_.Name)" }
}

function Get-RunningWebCssPath {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/login" -UseBasicParsing -TimeoutSec 3
    $match = [regex]::Match($response.Content, '/_next/static/css/[^"]+\.css')
    if ($match.Success) {
      return $match.Value
    }
  } catch {
    return $null
  }

  return $null
}

function Wait-ForPortRelease {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [Parameter(Mandatory = $false)]
    [int]$TimeoutSeconds = 15
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (-not (Get-ListenerOwner -Port $Port)) {
      return
    }
    Start-Sleep -Milliseconds 300
  }

  throw "port $Port did not become free within $TimeoutSeconds seconds"
}

function Stop-LotteryWebProcess {
  param(
    [Parameter(Mandatory = $true)]
    [int]$ProcessId,
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  Write-Host "[web] restarting outdated web server pid=$ProcessId on port $Port"
  Stop-Process -Id $ProcessId -Force
  Wait-ForPortRelease -Port $Port
}

function Is-LotteryWebProcess {
  param(
    [Parameter(Mandatory = $true)]
    [int]$ProcessId,
    [Parameter(Mandatory = $true)]
    [string]$Root
  )

  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId"
    if (-not $process) {
      return $false
    }

    $commandLine = ""
    if ($null -ne $process.CommandLine) {
      $commandLine = [string]$process.CommandLine
    }
    return $commandLine.Contains($Root) -and $commandLine.Contains("next") -and $commandLine.Contains("start")
  } catch {
    return $false
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $root "scripts/load-env.ps1") -Path $EnvFile

Set-Location $root
corepack pnpm tsx scripts/runtime-preflight.ts --role=web --env=$EnvFile
if ($LASTEXITCODE -ne 0) {
  throw "web runtime preflight failed"
}
$buildIdPath = Join-Path $root "apps/web/.next/BUILD_ID"
if (-not (Test-Path -LiteralPath $buildIdPath)) {
  Write-Host "[web] build artifacts not found. running production build..."
  corepack pnpm --filter @lottery/web build
  if ($LASTEXITCODE -ne 0) {
    throw "web production build failed"
  }
}

$currentBuildId = Read-CurrentBuildId -Path $buildIdPath
$currentCssAssetPaths = Get-CurrentCssAssetPaths -DirectoryPath (Join-Path $root "apps/web/.next/static/css")
$port = Resolve-WebPort
$listener = Get-ListenerOwner -Port $port
if ($listener) {
  $isLotteryWebProcess = Is-LotteryWebProcess -ProcessId $listener.OwningProcess -Root $root
  $endpointHealthy = Test-WebEndpoint -Port $port
  $runningCssPath = Get-RunningWebCssPath -Port $port
  $forceRestartRequested = $ForceRestart.IsPresent -and $isLotteryWebProcess
  $staleCssBuild =
    $isLotteryWebProcess -and
    $runningCssPath -and
    $currentCssAssetPaths.Count -gt 0 -and
    ($currentCssAssetPaths -notcontains $runningCssPath)

  if ($forceRestartRequested -or $staleCssBuild) {
    Stop-LotteryWebProcess -ProcessId $listener.OwningProcess -Port $port
    $listener = $null
  } elseif ($endpointHealthy -or $isLotteryWebProcess) {
    $displayCssPath = if ($runningCssPath) { $runningCssPath } else { "unknown" }
    Write-Host "[web] server already running on http://127.0.0.1:$port (pid=$($listener.OwningProcess), css=$displayCssPath, build=$currentBuildId)"
    return
  }
}

if ($listener) {
  throw "port $port is already occupied by another process (pid=$($listener.OwningProcess))"
}

corepack pnpm start:web
if ($LASTEXITCODE -ne 0) {
  throw "web server exited with a non-zero code"
}
