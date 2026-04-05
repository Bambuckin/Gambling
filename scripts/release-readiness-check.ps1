$ErrorActionPreference = "Stop"

$commands = @(
  "corepack pnpm --filter @lottery/domain test -- request-state-machine ledger-state-machine",
  "corepack pnpm --filter @lottery/application test -- purchase-orchestration-service terminal-retry-service ticket-verification-result-service admin-queue-service operations-alert-service terminal-handler-resolver-service terminal-execution-attempt-service",
  "corepack pnpm --filter @lottery/lottery-handlers typecheck",
  "corepack pnpm --filter @lottery/terminal-worker typecheck",
  "corepack pnpm --filter @lottery/web build",
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
