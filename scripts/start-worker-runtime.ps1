param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env"
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $root "scripts/load-env.ps1") -Path $EnvFile

Set-Location $root
corepack pnpm tsx scripts/runtime-preflight.ts --role=worker --env=$EnvFile
corepack pnpm start:worker
