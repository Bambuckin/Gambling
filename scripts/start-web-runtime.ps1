param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env"
)

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
. (Join-Path $root "scripts/load-env.ps1") -Path $EnvFile

Set-Location $root
corepack pnpm tsx scripts/runtime-preflight.ts --role=web --env=$EnvFile
$buildIdPath = Join-Path $root "apps/web/.next/BUILD_ID"
if (-not (Test-Path -LiteralPath $buildIdPath)) {
  Write-Host "[web] build artifacts not found. running production build..."
  corepack pnpm --filter @lottery/web build
}
corepack pnpm start:web
