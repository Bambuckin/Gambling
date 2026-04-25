param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

function Assert-LastExitCode {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  if ($LASTEXITCODE -ne 0) {
    throw "$Description failed with exit code $LASTEXITCODE"
  }
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $root "scripts/load-env.ps1") -Path $EnvFile

Set-Location $root
$terminalMode = if ([string]::IsNullOrWhiteSpace($env:LOTTERY_BIG8_TERMINAL_MODE)) {
  "mock"
} else {
  $env:LOTTERY_BIG8_TERMINAL_MODE
}
$pollIntervalMs = if ([string]::IsNullOrWhiteSpace($env:LOTTERY_TERMINAL_POLL_INTERVAL_MS)) {
  "3000"
} else {
  $env:LOTTERY_TERMINAL_POLL_INTERVAL_MS
}

Write-Host "[worker] env file: $EnvFile"
Write-Host "[worker] terminal mode: $terminalMode"
Write-Host "[worker] poll interval: $pollIntervalMs ms"

corepack pnpm tsx scripts/runtime-preflight.ts --role=worker --env=$EnvFile
Assert-LastExitCode -Description "worker runtime preflight"

corepack pnpm start:worker
Assert-LastExitCode -Description "terminal worker"
