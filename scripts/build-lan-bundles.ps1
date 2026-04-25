param(
  [Parameter(Mandatory = $false)]
  [string]$EnvFile = ".env",
  [Parameter(Mandatory = $false)]
  [string]$OutputRoot = "dist/lan-bundles",
  [Parameter(Mandatory = $false)]
  [string]$ServerIp = "",
  [Parameter(Mandatory = $false)]
  [int]$ServerPort = 3000,
  [Parameter(Mandatory = $false)]
  [string]$ClientHostName = "DESKTOP-HT0U9M8",
  [Parameter(Mandatory = $false)]
  [string]$ClientIp = "192.168.1.202",
  [Parameter(Mandatory = $false)]
  [string]$TerminalHostName = "AMG-MANAGER3",
  [Parameter(Mandatory = $false)]
  [string]$TerminalIp = "192.168.1.82",
  [Parameter(Mandatory = $false)]
  [string]$TerminalReceiverLabel = "AMG-MANAGER3",
  [Parameter(Mandatory = $false)]
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

function Resolve-LanServerIp {
  $candidate = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.IPAddress -notlike "10.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Sort-Object InterfaceAlias |
    Select-Object -First 1

  if ($candidate) {
    return $candidate.IPAddress
  }

  $fallback = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.PrefixOrigin -ne "WellKnown"
    } |
    Select-Object -First 1

  if ($fallback) {
    return $fallback.IPAddress
  }

  throw "Cannot auto-detect server LAN IP. Pass -ServerIp explicitly."
}

function Invoke-Main {
  $root = Resolve-Path (Join-Path $PSScriptRoot "..")
  Set-Location $root

  if (-not $SkipInstall.IsPresent) {
    Write-Host "[lan-bundles] installing workspace dependencies"
    corepack pnpm install
    if ($LASTEXITCODE -ne 0) {
      throw "workspace dependency install failed"
    }
  }

  $envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    $EnvFile
  } else {
    Join-Path $root $EnvFile
  }

  if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Env file not found: $envPath"
  }

  $envMap = Read-EnvFile -Path $envPath
  $backend = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_STORAGE_BACKEND" -DefaultValue "in-memory").Trim().ToLowerInvariant()
  if ($backend -ne "postgres") {
    throw "LAN bundle requires LOTTERY_STORAGE_BACKEND=postgres in $envPath"
  }

  $resolvedServerIp = if ($ServerIp.Trim().Length -gt 0) { $ServerIp.Trim() } else { Resolve-LanServerIp }
  Write-Host "[lan-bundles] server IP: $resolvedServerIp"

  $sharedPostgresUrl = Resolve-PostgresUrl -EnvMap $envMap -ServerIp $resolvedServerIp
  $resolvedServerPort = Resolve-ServerPort -EnvMap $envMap -FallbackPort $ServerPort
  $terminalLockTtlSeconds = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_TERMINAL_LOCK_TTL_SECONDS" -DefaultValue "30").Trim()
  $terminalPollIntervalMs = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_TERMINAL_POLL_INTERVAL_MS" -DefaultValue "3000").Trim()
  $liveDrawSyncEnabled = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED" -DefaultValue "true").Trim()
  $terminalMode = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_TERMINAL_MODE" -DefaultValue "mock").Trim()
  $terminalBrowserUrl = if ($terminalMode -eq "real") {
    (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_TERMINAL_BROWSER_URL" -DefaultValue "http://127.0.0.1:9222").Trim()
  } else {
    ""
  }
  $terminalPageUrl = if ($terminalMode -eq "real") {
    (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_TERMINAL_PAGE_URL" -DefaultValue "").Trim()
  } else {
    ""
  }
  $purchaseAutomation = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_PURCHASE_AUTOMATION_ENABLED" -DefaultValue "true").Trim()
  $cartAutomation = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_CART_AUTOMATION_ENABLED" -DefaultValue "").Trim()
  $drawSyncIntervalMs = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_DRAW_SYNC_INTERVAL_MS" -DefaultValue "5000").Trim()
  $drawModalWaitMs = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_DRAW_MODAL_WAIT_MS" -DefaultValue "2500").Trim()
  $drawTtlSeconds = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_DRAW_TTL_SECONDS" -DefaultValue "45").Trim()
  $actionTimeoutMs = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_ACTION_TIMEOUT_MS" -DefaultValue "8000").Trim()
  $reloadBeforePurchase = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_RELOAD_BEFORE_PURCHASE" -DefaultValue "true").Trim()
  $mockLatencyMs = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_BIG8_MOCK_LATENCY_MS" -DefaultValue "250").Trim()
  $handlerCodes = (Get-EnvValue -EnvMap $envMap -Key "LOTTERY_TERMINAL_HANDLER_CODES" -DefaultValue "bolshaya-8").Trim()
  $webBaseUrl = "http://$resolvedServerIp`:$resolvedServerPort"
  $clientUrl = "$webBaseUrl/login"
  $lotteryUrl = "$webBaseUrl/lottery/bolshaya-8"
  $terminalMonitorUrl = "$webBaseUrl/terminal/receiver"
  $profileTag = (Get-Date -Format "yyyyMMdd-HHmmss")

  $nodeBinaryPath = Resolve-NodeBinaryPath
  $esbuildCliPath = Resolve-EsbuildCliPath -Root $root

  $outputRootPath = if ([System.IO.Path]::IsPathRooted($OutputRoot)) {
    $OutputRoot
  } else {
    Join-Path $root $OutputRoot
  }

  if (Test-Path -LiteralPath $outputRootPath) {
    Stop-BundleNodeProcesses -OutputRootPath $outputRootPath
    Remove-DirectoryWithRetry -Path $outputRootPath
  }

  $clientBundlePath = Join-Path $outputRootPath "client-workstation"
  $terminalBundlePath = Join-Path $outputRootPath "terminal-receiver"
  $terminalRuntimePath = Join-Path $terminalBundlePath "runtime"

  New-Item -ItemType Directory -Path $clientBundlePath -Force | Out-Null
  New-Item -ItemType Directory -Path $terminalBundlePath -Force | Out-Null
  New-Item -ItemType Directory -Path $terminalRuntimePath -Force | Out-Null

  Write-Host "[lan-bundles] building portable terminal runtime"
  Bundle-NodeScript -NodeBinaryPath $nodeBinaryPath -EsbuildCliPath $esbuildCliPath `
    -EntryPoint (Join-Path $root "apps/terminal-worker/src/main.ts") `
    -OutputFile (Join-Path $terminalRuntimePath "terminal-worker.cjs") `
    -TsconfigPath (Join-Path $root "tsconfig.base.json")
  Bundle-NodeScript -NodeBinaryPath $nodeBinaryPath -EsbuildCliPath $esbuildCliPath `
    -EntryPoint (Join-Path $root "scripts/runtime-preflight.ts") `
    -OutputFile (Join-Path $terminalRuntimePath "runtime-preflight.cjs") `
    -TsconfigPath (Join-Path $root "tsconfig.base.json")
  Copy-Item -LiteralPath $nodeBinaryPath -Destination (Join-Path $terminalRuntimePath "node.exe") -Force

  $terminalEnvLines = @(
    "# Generated by scripts/build-lan-bundles.ps1",
    "LOTTERY_STORAGE_BACKEND=postgres",
    "LOTTERY_POSTGRES_URL=$sharedPostgresUrl",
    "DATABASE_URL=$sharedPostgresUrl",
    "LOTTERY_TERMINAL_LOCK_TTL_SECONDS=$terminalLockTtlSeconds",
    "LOTTERY_TERMINAL_POLL_INTERVAL_MS=$terminalPollIntervalMs",
    "LOTTERY_BIG8_LIVE_DRAW_SYNC_ENABLED=$liveDrawSyncEnabled",
    "LOTTERY_BIG8_PURCHASE_AUTOMATION_ENABLED=$purchaseAutomation",
    "LOTTERY_BIG8_CART_AUTOMATION_ENABLED=$cartAutomation",
    "LOTTERY_BIG8_TERMINAL_MODE=$terminalMode",
    "LOTTERY_BIG8_MOCK_LATENCY_MS=$mockLatencyMs",
    "LOTTERY_BIG8_DRAW_SYNC_INTERVAL_MS=$drawSyncIntervalMs",
    "LOTTERY_BIG8_DRAW_MODAL_WAIT_MS=$drawModalWaitMs",
    "LOTTERY_BIG8_DRAW_TTL_SECONDS=$drawTtlSeconds",
    "LOTTERY_BIG8_ACTION_TIMEOUT_MS=$actionTimeoutMs",
    "LOTTERY_BIG8_RELOAD_BEFORE_PURCHASE=$reloadBeforePurchase",
    "LOTTERY_TERMINAL_BROWSER_URL=$terminalBrowserUrl",
    "LOTTERY_TERMINAL_PAGE_URL=$terminalPageUrl",
    "LOTTERY_TERMINAL_HANDLER_CODES=$handlerCodes",
    "LOTTERY_TERMINAL_RECEIVER_LABEL=$TerminalReceiverLabel"
  )
  Write-TextFile -Path (Join-Path $terminalBundlePath "terminal-receiver.env") -Value ($terminalEnvLines -join [Environment]::NewLine)

  $builtAt = (Get-Date).ToString("o")

  Write-JsonFile -Path (Join-Path $clientBundlePath "client-config.json") -Value @{
    builtAt = $builtAt
    webBaseUrl = $webBaseUrl
    clientUrl = $clientUrl
    lotteryUrl = $lotteryUrl
    serverIp = $resolvedServerIp
    serverPort = $resolvedServerPort
  clientHostName = $ClientHostName
  clientIp = $ClientIp
  profileDirName = "chrome-profile-$profileTag"
}

  Write-JsonFile -Path (Join-Path $terminalBundlePath "terminal-config.json") -Value @{
    builtAt = $builtAt
    webBaseUrl = $webBaseUrl
    monitorUrl = $terminalMonitorUrl
    clientUrl = $clientUrl
    lotteryUrl = $lotteryUrl
    serverIp = $resolvedServerIp
    serverPort = $resolvedServerPort
  terminalHostName = $TerminalHostName
  terminalIp = $TerminalIp
  receiverLabel = $TerminalReceiverLabel
  profileDirName = "chrome-profile-$profileTag"
}

  Write-ClientLaunchers -BundlePath $clientBundlePath
  Write-TerminalLaunchers -BundlePath $terminalBundlePath

  $clientReadme = @"
============================================
  LOTTERY CASHIER KIOSK
============================================

Copy this folder to the cashier/client PC.
Target machine: $ClientHostName ($ClientIp)

HOW TO START:
  Double-click:  Start Client.cmd

WHAT IT DOES:
  - Opens Chrome or Edge in KIOSK MODE (fullscreen, no address bar)
  - Starts at: $clientUrl
  - Manual test page after login: $lotteryUrl
  - Keeps browser profile inside this folder
  - Console window stays open and shows status

============================================
  HOW TO EXIT THE KIOSK
============================================

  Option 1:  Press  Alt+F4  in the browser window
  Option 2:  Double-click  Stop Client.cmd  in this folder
  Option 3:  Press  Ctrl+C  in the launcher console window

  Any of these will close the kiosk browser.
  They will NOT affect the server or other clients.

============================================
  REQUIREMENTS
============================================

  - Central server must be running on $webBaseUrl
  - Client PC must be able to reach the server over LAN
  - Chrome or Edge must be installed on this PC
  - No Node.js, database, or repo needed here

ADVANCED:
  Start Client.cmd -- -NoKiosk
  (opens in app mode with title bar instead of fullscreen kiosk)
"@
  Write-TextFile -Path (Join-Path $clientBundlePath "README.txt") -Value $clientReadme

  $terminalReadme = @"
============================================
  LOTTERY TERMINAL RECEIVER
============================================

Copy this folder to the terminal PC.
Target machine: $TerminalHostName ($TerminalIp)

HOW TO START:
  Double-click:  Start Terminal Receiver.cmd

HOW TO STOP:
  Double-click:  Stop Terminal Receiver.cmd
  (stops the background worker process)

WHAT IT DOES:
  - Launches portable node runtime from this folder (no install needed)
  - Starts terminal receiver against shared Postgres on $resolvedServerIp using configured mode: $terminalMode
  - Opens receiver monitor at $terminalMonitorUrl
  - Writes worker logs to .\logs\

============================================
  REQUIREMENTS
============================================

  - Web app must be running on $webBaseUrl
  - PostgreSQL must accept LAN connections from this PC
  - Chrome or Edge recommended for the monitor page

LOG FILES:
  - logs\terminal-worker.stdout.log
  - logs\terminal-worker.stderr.log
"@
  Write-TextFile -Path (Join-Path $terminalBundlePath "README.txt") -Value $terminalReadme

  Write-JsonFile -Path (Join-Path $outputRootPath "bundle-manifest.json") -Value @{
    builtAt = $builtAt
    serverIp = $resolvedServerIp
    serverPort = $resolvedServerPort
    webBaseUrl = $webBaseUrl
    clientBundle = @{
      path = $clientBundlePath
      hostName = $ClientHostName
      ip = $ClientIp
      launcher = "Start Client.cmd"
    }
    terminalBundle = @{
      path = $terminalBundlePath
      hostName = $TerminalHostName
      ip = $TerminalIp
      launcher = "Start Terminal Receiver.cmd"
      receiverLabel = $TerminalReceiverLabel
    }
  }

  Write-Host "[lan-bundles] ready"
  Write-Host "[lan-bundles] client bundle   -> $clientBundlePath"
  Write-Host "[lan-bundles] terminal bundle -> $terminalBundlePath"
}

function Read-EnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $result = @{}
  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) {
      return
    }

    $parts = $line.Split("=", 2)
    if ($parts.Length -ne 2) {
      return
    }

    $key = $parts[0].Trim()
    if ($key.Length -eq 0) {
      return
    }

    $result[$key] = $parts[1]
  }

  return $result
}

function Get-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $false)]
    [string]$DefaultValue = ""
  )

  if ($EnvMap.ContainsKey($Key) -and $null -ne $EnvMap[$Key]) {
    return [string]$EnvMap[$Key]
  }

  return $DefaultValue
}

function Resolve-PostgresUrl {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap,
    [Parameter(Mandatory = $true)]
    [string]$ServerIp
  )

  $rawValue = (Get-EnvValue -EnvMap $EnvMap -Key "LOTTERY_POSTGRES_URL" -DefaultValue "")
  if ($rawValue.Trim().Length -eq 0) {
    $rawValue = Get-EnvValue -EnvMap $EnvMap -Key "DATABASE_URL" -DefaultValue ""
  }
  if ($rawValue.Trim().Length -eq 0) {
    throw "LOTTERY_POSTGRES_URL (or DATABASE_URL) is required to build LAN bundles"
  }

  $uriBuilder = [System.UriBuilder]::new($rawValue)
  $uriBuilder.Host = $ServerIp
  return $uriBuilder.Uri.AbsoluteUri
}

function Resolve-ServerPort {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap,
    [Parameter(Mandatory = $true)]
    [int]$FallbackPort
  )

  $rawPort = (Get-EnvValue -EnvMap $EnvMap -Key "PORT" -DefaultValue "").Trim()
  if ($rawPort.Length -eq 0) {
    return $FallbackPort
  }

  $parsedPort = 0
  if ([int]::TryParse($rawPort, [ref]$parsedPort) -and $parsedPort -ge 1 -and $parsedPort -le 65535) {
    return $parsedPort
  }

  return $FallbackPort
}

function Resolve-NodeBinaryPath {
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command -and (Test-Path -LiteralPath $command.Source)) {
    return $command.Source
  }

  $fallbackPath = "C:\Program Files\nodejs\node.exe"
  if (Test-Path -LiteralPath $fallbackPath) {
    return $fallbackPath
  }

  throw "Node.js binary not found. Install Node.js 20+ before building bundles."
}

function Resolve-EsbuildCliPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Root
  )

  $candidate = Get-ChildItem -Path (Join-Path $Root "node_modules/.pnpm") -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "esbuild@*" } |
    Sort-Object Name -Descending |
    Select-Object -First 1

  if (-not $candidate) {
    throw "esbuild package not found under node_modules/.pnpm. Run corepack pnpm install first."
  }

  $cliPath = Join-Path $candidate.FullName "node_modules/esbuild/bin/esbuild"
  if (-not (Test-Path -LiteralPath $cliPath)) {
    throw "esbuild CLI not found at $cliPath"
  }

  return $cliPath
}

function Stop-BundleNodeProcesses {
  param(
    [Parameter(Mandatory = $true)]
    [string]$OutputRootPath
  )

  $normalizedRoot = [System.IO.Path]::GetFullPath($OutputRootPath)
  $runningNodes = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -and [System.IO.Path]::GetFullPath($_.Path).StartsWith($normalizedRoot, [System.StringComparison]::OrdinalIgnoreCase)
  }

  foreach ($process in $runningNodes) {
    Stop-Process -Id $process.Id -Force
    Wait-Process -Id $process.Id -Timeout 10 -ErrorAction SilentlyContinue
  }
}

function Remove-DirectoryWithRetry {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  for ($attempt = 1; $attempt -le 10; $attempt++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force
      return
    } catch {
      if ($attempt -eq 10) {
        throw
      }
      Start-Sleep -Milliseconds 400
    }
  }
}

function Bundle-NodeScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$NodeBinaryPath,
    [Parameter(Mandatory = $true)]
    [string]$EsbuildCliPath,
    [Parameter(Mandatory = $true)]
    [string]$EntryPoint,
    [Parameter(Mandatory = $true)]
    [string]$OutputFile,
    [Parameter(Mandatory = $true)]
    [string]$TsconfigPath
  )

  & $NodeBinaryPath $EsbuildCliPath $EntryPoint `
    "--bundle" `
    "--platform=node" `
    "--format=cjs" `
    "--outfile=$OutputFile" `
    "--tsconfig=$TsconfigPath"

  if ($LASTEXITCODE -ne 0) {
    throw "esbuild failed for $EntryPoint"
  }
}

function Write-JsonFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [object]$Value
  )

  $json = $Value | ConvertTo-Json -Depth 8
  Write-TextFile -Path $Path -Value $json
}

function Write-TextFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  Set-Content -LiteralPath $Path -Value $Value -Encoding ascii
}

function Write-ClientLaunchers {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath
  )

  $clientScript = @'
param(
  [switch]$NoKiosk
)

$ErrorActionPreference = "Stop"

function Resolve-BrowserPath {
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

function Resolve-ProfileDir {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BundleRoot
  )

  $profilesRoot = Join-Path $BundleRoot "profiles"
  New-Item -ItemType Directory -Path $profilesRoot -Force | Out-Null

  $profileDir = Join-Path $profilesRoot ("chrome-profile-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
  return $profileDir
}

function Find-KioskBrowserProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProfileDir
  )

  $normalizedProfile = [System.IO.Path]::GetFullPath($ProfileDir).TrimEnd("\")
  $browserNames = @("chrome", "msedge")

  foreach ($name in $browserNames) {
    $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
    foreach ($proc in $procs) {
      if ($null -eq $proc.Path) { continue }
      try {
        $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
        if ($cmdLine -and $cmdLine.Contains($normalizedProfile)) {
          return $proc
        }
      } catch {
        continue
      }
    }
  }

  return $null
}

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$configPath = Join-Path $bundleRoot "client-config.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$profileDir = Resolve-ProfileDir -BundleRoot $bundleRoot

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LOTTERY CASHIER KIOSK" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Server: $($config.webBaseUrl)" -ForegroundColor White
Write-Host "  Start:  $($config.clientUrl)" -ForegroundColor White
if ($config.PSObject.Properties.Name -contains "lotteryUrl") {
  Write-Host "  Test:   $($config.lotteryUrl)" -ForegroundColor White
}
Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host "  HOW TO EXIT:" -ForegroundColor Yellow
Write-Host "    Press Alt+F4 in the browser window" -ForegroundColor White
Write-Host "    OR double-click 'Stop Client.cmd'" -ForegroundColor White
Write-Host "    OR close this console window" -ForegroundColor White
Write-Host "----------------------------------------" -ForegroundColor Yellow
Write-Host ""

$browserPath = Resolve-BrowserPath
$browserProcess = $null

if ($browserPath) {
  $kioskArgs = @(
    "--user-data-dir=$profileDir",
    "--disable-extensions",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check"
  )

  if ($NoKiosk.IsPresent) {
    $kioskArgs += @("--app=$($config.clientUrl)", "--start-maximized")
  } else {
    $kioskArgs += @("--kiosk", "$($config.clientUrl)")
  }

  $browserProcess = Start-Process -FilePath $browserPath -ArgumentList $kioskArgs -PassThru
} else {
  Start-Process -FilePath $config.clientUrl | Out-Null
  Write-Host "[client] Chrome/Edge not found; opened in default browser (kiosk mode not available)"
}

$pidFile = Join-Path $bundleRoot "run\client-browser.pid"
$runDir = Join-Path $bundleRoot "run"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

if ($browserProcess) {
  Set-Content -LiteralPath $pidFile -Value $browserProcess.Id
  Write-Host "[client] browser pid=$($browserProcess.Id)"
}

Write-Host "[client] running; close browser or press Ctrl+C here to stop"
Write-Host ""

try {
  if ($browserProcess) {
    $browserProcess.WaitForExit()
    Write-Host "[client] browser closed"
  } else {
    Read-Host "Press Enter to close"
  }
} catch {
  Write-Host "[client] interrupted"
}

$existing = Find-KioskBrowserProcess -ProfileDir $profileDir
if ($existing) {
  Write-Host "[client] stopping remaining browser process pid=$($existing.Id)"
  Stop-Process -Id $existing.Id -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $pidFile) {
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}
'@

  $clientCmd = @'
@echo off
setlocal
title Lottery Cashier Kiosk
powershell -ExecutionPolicy Bypass -File "%~dp0Start Client.ps1"
if errorlevel 1 (
  echo.
  echo Kiosk launch failed. Check the error above.
  pause
)
'@

  $stopClientScript = @'
$ErrorActionPreference = "Stop"

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $bundleRoot "run\client-browser.pid"

Write-Host "[stop-client] looking for kiosk browser process..."

$stopped = $false

if (Test-Path -LiteralPath $pidFile) {
  $rawPid = (Get-Content -LiteralPath $pidFile -Raw).Trim()
  if ($rawPid.Length -gt 0) {
    try {
      $proc = Get-Process -Id $rawPid -ErrorAction Stop
      $procPath = [System.IO.Path]::GetFileName($proc.Path).ToLowerInvariant()
      if ($procPath -in @("chrome.exe", "msedge.exe")) {
        Write-Host "[stop-client] stopping browser pid=$rawPid"
        Stop-Process -Id $rawPid -Force
        $stopped = $true
      }
    } catch {
      Write-Host "[stop-client] pid=$rawPid no longer running"
    }
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
}

if (-not $stopped) {
  $profilesRoot = Join-Path $bundleRoot "profiles"
  if (Test-Path -LiteralPath $profilesRoot) {
    $latestProfile = Get-ChildItem -LiteralPath $profilesRoot -Directory |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1

    if ($latestProfile) {
      $normalizedProfile = $latestProfile.FullName.TrimEnd("\")
      foreach ($name in @("chrome", "msedge")) {
        $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
        foreach ($proc in $procs) {
          try {
            $cmdLine = (Get-CimInstance Win32_Process -Filter "ProcessId=$($proc.Id)" -ErrorAction SilentlyContinue).CommandLine
            if ($cmdLine -and $cmdLine.Contains($normalizedProfile)) {
              Write-Host "[stop-client] stopping browser pid=$($proc.Id)"
              Stop-Process -Id $proc.Id -Force
              $stopped = $true
            }
          } catch { continue }
        }
      }
    }
  }
}

if ($stopped) {
  Write-Host "[stop-client] done - kiosk browser stopped"
} else {
  Write-Host "[stop-client] no kiosk browser found - it may already be closed"
}
'@

  $stopClientCmd = @'
@echo off
setlocal
title Stop Lottery Client
powershell -ExecutionPolicy Bypass -File "%~dp0Stop Client.ps1"
timeout /t 3 /nobreak >nul
'@

  Write-TextFile -Path (Join-Path $BundlePath "Start Client.ps1") -Value $clientScript
  Write-TextFile -Path (Join-Path $BundlePath "Start Client.cmd") -Value $clientCmd
  Write-TextFile -Path (Join-Path $BundlePath "Stop Client.ps1") -Value $stopClientScript
  Write-TextFile -Path (Join-Path $BundlePath "Stop Client.cmd") -Value $stopClientCmd
}

function Write-TerminalLaunchers {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BundlePath
  )

  $terminalScript = @'
param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

function Import-DotEnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line.Length -eq 0 -or $line.StartsWith("#")) {
      return
    }

    $parts = $line.Split("=", 2)
    if ($parts.Length -ne 2) {
      return
    }

    [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1], "Process")
  }
}

function Resolve-BrowserPath {
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

function Resolve-ProfileDir {
  param(
    [Parameter(Mandatory = $true)]
    [string]$BundleRoot
  )

  $profilesRoot = Join-Path $BundleRoot "profiles"
  New-Item -ItemType Directory -Path $profilesRoot -Force | Out-Null

  $profileDir = Join-Path $profilesRoot ("chrome-profile-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
  return $profileDir
}

function Get-ExistingWorkerProcess {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PidFile
  )

  if (-not (Test-Path -LiteralPath $PidFile)) {
    return $null
  }

  $rawPid = (Get-Content -LiteralPath $PidFile -Raw).Trim()
  if ($rawPid.Length -eq 0) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return $null
  }

  try {
    $process = Get-Process -Id $rawPid -ErrorAction Stop
    return $process
  } catch {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return $null
  }
}

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtimeRoot = Join-Path $bundleRoot "runtime"
$configPath = Join-Path $bundleRoot "terminal-config.json"
$envPath = Join-Path $bundleRoot "terminal-receiver.env"
$logsDir = Join-Path $bundleRoot "logs"
$runDir = Join-Path $bundleRoot "run"
$pidFile = Join-Path $runDir "terminal-worker.pid"
$stdoutPath = Join-Path $logsDir "terminal-worker.stdout.log"
$stderrPath = Join-Path $logsDir "terminal-worker.stderr.log"

Import-DotEnvFile -Path $envPath
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$profileDir = Resolve-ProfileDir -BundleRoot $bundleRoot

foreach ($path in @($logsDir, $runDir, $profileDir)) {
  New-Item -ItemType Directory -Path $path -Force | Out-Null
}

$preflightScript = Join-Path $runtimeRoot "runtime-preflight.cjs"
$workerScript = Join-Path $runtimeRoot "terminal-worker.cjs"
$nodeBinary = Join-Path $runtimeRoot "node.exe"

& $nodeBinary $preflightScript "--role=worker" "--env=$envPath"
if ($LASTEXITCODE -ne 0) {
  throw "terminal receiver preflight failed"
}

$existingWorker = Get-ExistingWorkerProcess -PidFile $pidFile
$workerProcess = $existingWorker
if (-not $existingWorker) {
  $workerProcess = Start-Process -FilePath $nodeBinary `
    -ArgumentList @($workerScript) `
    -WorkingDirectory $runtimeRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru

  Set-Content -LiteralPath $pidFile -Value $workerProcess.Id
}

if ($NoBrowser.IsPresent) {
  if ($workerProcess) {
    Write-Host "[receiver] worker pid=$($workerProcess.Id)"
  }
  return
}

$browserPath = Resolve-BrowserPath
if ($browserPath) {
  Start-Process -FilePath $browserPath -ArgumentList @(
    "--app=$($config.monitorUrl)",
    "--user-data-dir=$profileDir",
    "--disable-extensions",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized"
  ) | Out-Null
} else {
  Start-Process -FilePath $config.monitorUrl | Out-Null
}

if ($workerProcess) {
  Write-Host "[receiver] worker pid=$($workerProcess.Id)"
}
Write-Host "[receiver] monitor url: $($config.monitorUrl)"
Write-Host "[receiver] stdout log: $stdoutPath"
Write-Host "[receiver] stderr log: $stderrPath"
Write-Host "[receiver] close this window to stop log view only; worker keeps running"
Get-Content -LiteralPath @($stdoutPath, $stderrPath) -Tail 20 -Wait
'@

  $terminalCmd = @'
@echo off
setlocal
powershell -ExecutionPolicy Bypass -File "%~dp0Start Terminal Receiver.ps1"
'@

  $stopTerminalScript = @'
$ErrorActionPreference = "Stop"

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $bundleRoot "run\terminal-worker.pid"

Write-Host "[stop-receiver] looking for terminal worker process..."

if (Test-Path -LiteralPath $pidFile) {
  $rawPid = (Get-Content -LiteralPath $pidFile -Raw).Trim()
  if ($rawPid.Length -gt 0) {
    try {
      $proc = Get-Process -Id $rawPid -ErrorAction Stop
      Write-Host "[stop-receiver] stopping worker pid=$rawPid"
      Stop-Process -Id $rawPid -Force
      Start-Sleep -Milliseconds 500
      $proc2 = Get-Process -Id $rawPid -ErrorAction SilentlyContinue
      if ($proc2) {
        Stop-Process -Id $rawPid -Force -ErrorAction SilentlyContinue
      }
      Write-Host "[stop-receiver] done"
    } catch {
      Write-Host "[stop-receiver] pid=$rawPid no longer running"
    }
  }
  Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
} else {
  $runtimeRoot = Join-Path $bundleRoot "runtime"
  $nodeExe = Join-Path $runtimeRoot "node.exe"
  if (Test-Path -LiteralPath $nodeExe) {
    $normalizedNode = [System.IO.Path]::GetFullPath($nodeExe)
    $workers = Get-Process node -ErrorAction SilentlyContinue | Where-Object {
      $_.Path -and [System.IO.Path]::GetFullPath($_.Path).Equals($normalizedNode, [System.StringComparison]::OrdinalIgnoreCase)
    }
    if ($workers) {
      foreach ($w in $workers) {
        Write-Host "[stop-receiver] stopping worker pid=$($w.Id)"
        Stop-Process -Id $w.Id -Force
      }
      Write-Host "[stop-receiver] done"
    } else {
      Write-Host "[stop-receiver] no terminal worker found"
    }
  } else {
    Write-Host "[stop-receiver] no terminal worker found"
  }
}
'@

  $stopTerminalCmd = @'
@echo off
setlocal
title Stop Terminal Receiver
powershell -ExecutionPolicy Bypass -File "%~dp0Stop Terminal Receiver.ps1"
timeout /t 3 /nobreak >nul
'@

  Write-TextFile -Path (Join-Path $BundlePath "Start Terminal Receiver.ps1") -Value $terminalScript
  Write-TextFile -Path (Join-Path $BundlePath "Start Terminal Receiver.cmd") -Value $terminalCmd
  Write-TextFile -Path (Join-Path $BundlePath "Stop Terminal Receiver.ps1") -Value $stopTerminalScript
  Write-TextFile -Path (Join-Path $BundlePath "Stop Terminal Receiver.cmd") -Value $stopTerminalCmd
}

Invoke-Main
