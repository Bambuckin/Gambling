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

$env:LOTTERY_BIG8_TERMINAL_MODE = "mock"
$env:LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED = "false"

Write-Host "[worker-mock] LOTTERY_BIG8_TERMINAL_MODE=mock"
Write-Host "[worker-mock] LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED=false"

Set-Location $root
corepack pnpm tsx scripts/runtime-preflight.ts --role=worker --env=$EnvFile
Assert-LastExitCode -Description "mock worker runtime preflight"

corepack pnpm start:worker
Assert-LastExitCode -Description "mock terminal worker"
