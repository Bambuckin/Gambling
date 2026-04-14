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
  [string]$Hostname = "0.0.0.0",
  [Parameter(Mandatory = $false)]
  [int]$Port = 3000,
  [Parameter(Mandatory = $false)]
  [ValidateSet("if-empty", "force", "skip")]
  [string]$SeedMode = "if-empty",
  [Parameter(Mandatory = $false)]
  [switch]$ResetRuntime,
  [Parameter(Mandatory = $false)]
  [switch]$SkipInstall,
  [Parameter(Mandatory = $false)]
  [switch]$SkipBootstrap,
  [Parameter(Mandatory = $false)]
  [switch]$SkipStart,
  [Parameter(Mandatory = $false)]
  [switch]$ForceEnv,
  [Parameter(Mandatory = $false)]
  [switch]$ForceRestart
)

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
    Write-Host "[prepare-web] force env regeneration requested"
  } else {
    Write-Host "[prepare-web] env file missing -> generating from template"
  }

  $createArgs = @{
    Role = "web"
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
  if ($PSBoundParameters.ContainsKey("Hostname")) {
    $createArgs["Hostname"] = $Hostname
  }
  if ($PSBoundParameters.ContainsKey("Port")) {
    $createArgs["Port"] = $Port
  }

  . (Join-Path $root "scripts/create-runtime-env.ps1") @createArgs
}

if (-not $SkipInstall.IsPresent) {
  Write-Host "[prepare-web] installing dependencies"
  corepack pnpm install
  if ($LASTEXITCODE -ne 0) {
    throw "workspace dependency install failed"
  }
}

if ($SkipBootstrap.IsPresent) {
  Write-Host "[prepare-web] bootstrap skipped (SkipBootstrap=true)"
} else {
  Write-Host "[prepare-web] bootstrap database + seed mode=$SeedMode"
  $bootstrapArgs = @{
    EnvFile = $envPath
    SeedMode = $SeedMode
  }
  if ($ResetRuntime.IsPresent) {
    $bootstrapArgs["ResetRuntime"] = $true
  }
  & (Join-Path $root "scripts/bootstrap-runtime.ps1") @bootstrapArgs
}

if ($SkipStart.IsPresent) {
  Write-Host "[prepare-web] done without start (SkipStart=true)"
  return
}

Write-Host "[prepare-web] starting web runtime"
$startArgs = @{
  EnvFile = $envPath
}
if ($ForceRestart.IsPresent) {
  $startArgs["ForceRestart"] = $true
}

& (Join-Path $root "scripts/start-web-runtime.ps1") @startArgs
