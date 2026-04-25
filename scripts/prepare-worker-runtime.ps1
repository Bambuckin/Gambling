param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env",
  [Parameter(Mandatory = $false)]
  [string]$HostsFile = "ops/runtime/hosts.json",
  [Parameter(Mandatory = $false)]
  [string]$DbHost,
  [Parameter(Mandatory = $false)]
  [int]$DbPort = 5432,
  [Parameter(Mandatory = $false)]
  [string]$DbName = "lottery",
  [Parameter(Mandatory = $false)]
  [string]$DbUser = "lottery",
  [Parameter(Mandatory = $false)]
  [string]$DbPassword,
  [Parameter(Mandatory = $false)]
  [string]$TerminalBrowserUrl = "http://127.0.0.1:9222",
  [Parameter(Mandatory = $false)]
  [string]$TerminalPageUrl = "",
  [Parameter(Mandatory = $false)]
  [switch]$OpenTerminalChrome,
  [Parameter(Mandatory = $false)]
  [string]$ChromePath = "",
  [Parameter(Mandatory = $false)]
  [string]$ChromeUserDataDir = "C:\LotteryTerminalChrome",
  [Parameter(Mandatory = $false)]
  [switch]$SkipInstall,
  [Parameter(Mandatory = $false)]
  [switch]$SkipStart,
  [Parameter(Mandatory = $false)]
  [switch]$ForceEnv
)

$ErrorActionPreference = "Stop"

function Resolve-BrowserPath {
  param(
    [Parameter(Mandatory = $false)]
    [string]$PreferredPath
  )

  if (-not [string]::IsNullOrWhiteSpace($PreferredPath) -and (Test-Path -LiteralPath $PreferredPath)) {
    return $PreferredPath
  }

  $candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
  $EnvFile
} else {
  Join-Path $root $EnvFile
}

$shouldGenerateEnv = (-not (Test-Path -LiteralPath $envPath)) -or $ForceEnv.IsPresent
if ($shouldGenerateEnv) {
  if (Test-Path -LiteralPath $envPath) {
    Write-Host "[prepare-worker] force env regeneration requested"
  } else {
    Write-Host "[prepare-worker] env file missing -> generating from template"
  }

  $createArgs = @{
    Role = "worker"
    OutputPath = $envPath
    HostsFile = $HostsFile
  }
  if ($ForceEnv.IsPresent) {
    $createArgs["Force"] = $true
  }
  if ($PSBoundParameters.ContainsKey("DbHost")) {
    $createArgs["DbHost"] = $DbHost
  }
  if ($PSBoundParameters.ContainsKey("DbPort")) {
    $createArgs["DbPort"] = $DbPort
  }
  if ($PSBoundParameters.ContainsKey("DbName")) {
    $createArgs["DbName"] = $DbName
  }
  if ($PSBoundParameters.ContainsKey("DbUser")) {
    $createArgs["DbUser"] = $DbUser
  }
  if ($PSBoundParameters.ContainsKey("DbPassword")) {
    $createArgs["DbPassword"] = $DbPassword
  }
  if ($PSBoundParameters.ContainsKey("TerminalBrowserUrl")) {
    $createArgs["TerminalBrowserUrl"] = $TerminalBrowserUrl
  }
  if ($PSBoundParameters.ContainsKey("TerminalPageUrl")) {
    $createArgs["TerminalPageUrl"] = $TerminalPageUrl
  }

  . (Join-Path $root "scripts/create-runtime-env.ps1") @createArgs
}

if (-not $SkipInstall.IsPresent) {
  Write-Host "[prepare-worker] installing dependencies"
  corepack pnpm install
  if ($LASTEXITCODE -ne 0) {
    throw "workspace dependency install failed"
  }
}

. (Join-Path $root "scripts/load-env.ps1") -Path $envPath

if ($OpenTerminalChrome.IsPresent) {
  $resolvedTerminalMode = if ([string]::IsNullOrWhiteSpace($env:LOTTERY_BIG8_TERMINAL_MODE)) {
    "mock"
  } else {
    $env:LOTTERY_BIG8_TERMINAL_MODE.Trim().ToLowerInvariant()
  }
  if ($resolvedTerminalMode -ne "real") {
    throw "OpenTerminalChrome is only valid when LOTTERY_BIG8_TERMINAL_MODE=real."
  }

  $resolvedTerminalPageUrl = if (-not [string]::IsNullOrWhiteSpace($TerminalPageUrl)) {
    $TerminalPageUrl
  } else {
    $env:LOTTERY_TERMINAL_PAGE_URL
  }

  if ([string]::IsNullOrWhiteSpace($resolvedTerminalPageUrl)) {
    throw "OpenTerminalChrome requires LOTTERY_TERMINAL_PAGE_URL in env or -TerminalPageUrl explicitly."
  }

  $resolvedBrowserPath = Resolve-BrowserPath -PreferredPath $ChromePath
  if (-not $resolvedBrowserPath) {
    throw "No Chromium-based browser binary found (Chrome/Edge). Provide -ChromePath explicitly."
  }

  Write-Host "[prepare-worker] starting Chrome with remote debugging"
  Start-Process -FilePath $resolvedBrowserPath -ArgumentList @(
    "--remote-debugging-port=9222",
    "--user-data-dir=$ChromeUserDataDir",
    $resolvedTerminalPageUrl
  ) | Out-Null
}

if ($SkipStart.IsPresent) {
  Write-Host "[prepare-worker] done without start (SkipStart=true)"
  return
}

Write-Host "[prepare-worker] starting terminal worker runtime"
& (Join-Path $root "scripts/start-worker-runtime.ps1") -EnvFile $envPath
