$ErrorActionPreference = "Stop"

$commands = @(
  "corepack pnpm --filter @lottery/domain test -- request-state-machine ledger-state-machine",
  "corepack pnpm --filter @lottery/application test -- --runInBand purchase-request-query-service ticket-query-service user-cabinet-stats-service terminal-receiver-query-service admin-operations-query-service admin-queue-service winning-fulfillment-service winnings-credit-service ticket-verification-result-service admin-test-reset-service",
  "corepack pnpm --filter @lottery/application typecheck",
  "corepack pnpm --filter @lottery/lottery-handlers typecheck",
  "corepack pnpm --filter @lottery/terminal-worker typecheck",
  "corepack pnpm --filter @lottery/infrastructure typecheck",
  "corepack pnpm --filter @lottery/web build",
  "corepack pnpm --filter @lottery/web typecheck",
  "corepack pnpm smoke"
)

foreach ($command in $commands) {
  Write-Host "==> $command"
  Invoke-Expression $command
  if ($LASTEXITCODE -ne 0) {
    throw "Release readiness check failed: $command (exit=$LASTEXITCODE)"
  }
}

Write-Host "Release readiness checks passed."
