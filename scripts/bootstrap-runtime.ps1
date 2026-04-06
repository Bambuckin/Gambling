param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env",
  [Parameter(Mandatory = $false)]
  [ValidateSet("if-empty", "force", "skip")]
  [string]$SeedMode = "if-empty",
  [Parameter(Mandatory = $false)]
  [switch]$ResetRuntime
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $root "scripts/load-env.ps1") -Path $EnvFile

Set-Location $root
corepack pnpm tsx scripts/runtime-preflight.ts --role=all --env=$EnvFile

$args = @("tsx", "scripts/postgres-init-and-seed.ts", "--seed-mode=$SeedMode")
if ($ResetRuntime.IsPresent) {
  $args += "--reset-runtime"
}

corepack pnpm @args
