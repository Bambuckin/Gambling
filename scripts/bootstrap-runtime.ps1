param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env",
  [Parameter(Mandatory = $false)]
  [ValidateSet("if-empty", "force", "skip")]
  [string]$SeedMode = "if-empty",
  [Parameter(Mandatory = $false)]
  [switch]$ResetRuntime
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $root "scripts/load-env.ps1") -Path $EnvFile

Set-Location $root
corepack pnpm tsx scripts/runtime-preflight.ts --role=all --env=$EnvFile
if ($LASTEXITCODE -ne 0) {
  throw "runtime preflight failed"
}

$args = @("tsx", "scripts/postgres-init-and-seed.ts", "--seed-mode=$SeedMode")
if ($ResetRuntime.IsPresent) {
  $args += "--reset-runtime"
}

corepack pnpm @args
if ($LASTEXITCODE -ne 0) {
  throw "postgres bootstrap failed"
}
