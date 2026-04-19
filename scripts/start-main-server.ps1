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

function Invoke-Main {
  $root = Resolve-Path (Join-Path $PSScriptRoot "..")
  Set-Location $root
  $host.UI.RawUI.WindowTitle = "Lottery Main Server"

  $envPath = if ([System.IO.Path]::IsPathRooted($EnvFile)) {
    $EnvFile
  } else {
    Join-Path $root $EnvFile
  }

  if (-not (Test-Path -LiteralPath $envPath)) {
    throw "Env file not found: $envPath"
  }

  $envMap = Read-EnvFile -Path $envPath
  $webPort = Resolve-WebPort -EnvMap $envMap
  Ensure-WebLanAccess -Port $webPort -EnvFile $envPath -SeedMode $SeedMode -ResetRuntime:$ResetRuntime.IsPresent
  $postgresConnection = Resolve-PostgresConnection -EnvMap $envMap
  Ensure-PostgresReady -Root $root -Connection $postgresConnection -EnvFile $envPath -SeedMode $SeedMode -ResetRuntime:$ResetRuntime.IsPresent

  $prepareArgs = @{
    EnvFile = $envPath
    SeedMode = $SeedMode
    ForceRestart = $true
  }

  if (Test-Path -LiteralPath (Join-Path $root "node_modules")) {
    $prepareArgs["SkipInstall"] = $true
  }

  if ($ResetRuntime.IsPresent) {
    $prepareArgs["ResetRuntime"] = $true
  }

  Write-Host "[main-server] starting from $root"
  Write-Host "[main-server] env=$envPath seedMode=$SeedMode"
  & (Join-Path $root "scripts/prepare-web-runtime.ps1") @prepareArgs
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

function Resolve-WebPort {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap
  )

  $rawPort = (Get-EnvValue -EnvMap $EnvMap -Key "PORT" -DefaultValue "3000").Trim()
  $port = 0
  if ([int]::TryParse($rawPort, [ref]$port) -and $port -ge 1 -and $port -le 65535) {
    return $port
  }

  throw "Invalid PORT value in env file: $rawPort"
}

function Resolve-PostgresConnection {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap
  )

  $storageBackend = (Get-EnvValue -EnvMap $EnvMap -Key "LOTTERY_STORAGE_BACKEND" -DefaultValue "in-memory").Trim().ToLowerInvariant()
  if ($storageBackend -ne "postgres") {
    return $null
  }

  $rawConnection = (Get-EnvValue -EnvMap $EnvMap -Key "LOTTERY_POSTGRES_URL" -DefaultValue "").Trim()
  if ($rawConnection.Length -eq 0) {
    $rawConnection = (Get-EnvValue -EnvMap $EnvMap -Key "DATABASE_URL" -DefaultValue "").Trim()
  }
  if ($rawConnection.Length -eq 0) {
    throw "LOTTERY_STORAGE_BACKEND=postgres requires LOTTERY_POSTGRES_URL or DATABASE_URL"
  }

  $uri = [System.Uri]::new($rawConnection)
  $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
  return [pscustomobject]@{
    Host = $uri.Host
    Port = $port
    RawConnection = $rawConnection
  }
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

function Ensure-PostgresReady {
  param(
    [Parameter(Mandatory = $false)]
    [pscustomobject]$Connection,
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [Parameter(Mandatory = $true)]
    [string]$EnvFile,
    [Parameter(Mandatory = $true)]
    [string]$SeedMode,
    [Parameter(Mandatory = $true)]
    [bool]$ResetRuntime
  )

  if ($null -eq $Connection) {
    return
  }

  if (-not (Is-LocalHost -ServerHost $Connection.Host)) {
    if (Test-TcpPort -ServerHost $Connection.Host -Port $Connection.Port) {
      return
    }
    throw "Postgres is not reachable at $($Connection.Host):$($Connection.Port). Fix LOTTERY_POSTGRES_URL before starting the main server."
  }

  $postgresService = Get-PostgresServiceDetails
  if ($postgresService) {
    $needsServiceStart = -not (Test-TcpPort -ServerHost $Connection.Host -Port $Connection.Port)
    $needsLanConfig = Test-PostgresLanConfigRequired -ServiceDetails $postgresService
    $needsListenAddresses = Test-PostgresListenAddressesRequired -ServiceDetails $postgresService
    $needsFirewallRule = -not (Test-PostgresFirewallRule -Port $Connection.Port)

    if ($needsServiceStart -or $needsLanConfig -or $needsListenAddresses -or $needsFirewallRule) {
      Ensure-ElevatedForSystemChange -EnvFile $EnvFile -SeedMode $SeedMode -ResetRuntime:$ResetRuntime -Reason "local PostgreSQL"
    }

    if ($needsLanConfig) {
      Ensure-PostgresLanAccess -ServiceDetails $postgresService
    }

    if ($needsListenAddresses) {
      Ensure-PostgresListenAddresses -ServiceDetails $postgresService
    }

    Ensure-PostgresFirewallRule -Port $Connection.Port

    if ($postgresService.Status -ne "Running") {
      Write-Host "[main-server] starting local PostgreSQL service: $($postgresService.Name)"
      Start-Service -Name $postgresService.Name
    }

    Wait-ForTcpPort -ServerHost $Connection.Host -Port $Connection.Port -TimeoutSeconds 30
    return
  }

  if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Host "[main-server] starting dockerized PostgreSQL"
    docker compose -f (Join-Path $Root "docker-compose.postgres.yml") up -d
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose postgres start failed"
    }
    Wait-ForTcpPort -ServerHost $Connection.Host -Port $Connection.Port -TimeoutSeconds 30
    return
  }

  throw "Postgres is configured on localhost but is not running. Install/start local PostgreSQL or Docker, then retry."
}

function Ensure-WebLanAccess {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [Parameter(Mandatory = $true)]
    [string]$EnvFile,
    [Parameter(Mandatory = $true)]
    [string]$SeedMode,
    [Parameter(Mandatory = $true)]
    [bool]$ResetRuntime
  )

  if (Test-LotteryWebFirewallRule -Port $Port) {
    return
  }

  Ensure-ElevatedForSystemChange -EnvFile $EnvFile -SeedMode $SeedMode -ResetRuntime:$ResetRuntime -Reason "Windows Firewall rule for LAN access"
  Write-Host "[main-server] enabling LAN HTTP access on port $Port through Windows Firewall"
  New-NetFirewallRule `
    -DisplayName (Get-LotteryWebFirewallRuleName -Port $Port) `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -RemoteAddress LocalSubnet `
    -Profile @("Private", "Public") | Out-Null
}

function Get-PostgresServiceDetails {
  $services = Get-CimInstance Win32_Service -Filter "Name LIKE 'postgresql%'" -ErrorAction SilentlyContinue |
    Sort-Object Name
  if (-not $services) {
    return $null
  }

  $service = $services | Select-Object -First 1
  $pathName = [string]$service.PathName
  $pgCtlPath = ""
  $dataDirectory = ""

  if ($pathName -match '^"(?<exe>[^"]+)"') {
    $pgCtlPath = $Matches["exe"]
  }
  if ($pathName -match '-D\s+"(?<dir>[^"]+)"') {
    $dataDirectory = $Matches["dir"]
  }

  return [pscustomobject]@{
    Name = [string]$service.Name
    Status = if ([string]$service.State -eq "Running") { "Running" } else { [string]$service.State }
    PathName = $pathName
    PgCtlPath = $pgCtlPath
    DataDirectory = $dataDirectory
  }
}

function Ensure-ElevatedForSystemChange {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvFile,
    [Parameter(Mandatory = $true)]
    [string]$SeedMode,
    [Parameter(Mandatory = $true)]
    [bool]$ResetRuntime,
    [Parameter(Mandatory = $true)]
    [string]$Reason
  )

  if (Test-IsAdministrator) {
    return
  }

  Write-Host "[main-server] $Reason needs administrator access; requesting elevation"
  $arguments = @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$PSCommandPath`"",
    "-EnvFile", "`"$EnvFile`"",
    "-SeedMode", $SeedMode
  )
  if ($ResetRuntime) {
    $arguments += "-ResetRuntime"
  }

  try {
    Start-Process -FilePath "powershell" -Verb RunAs -ArgumentList $arguments | Out-Null
    Write-Host "[main-server] elevated continuation opened in a new window; continue there"
    Start-Sleep -Seconds 2
    Stop-Process -Id $PID -Force
  } catch {
    throw "Administrator elevation was not completed. Accept the UAC prompt to continue startup."
  }
}

function Get-LotteryWebFirewallRuleName {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  return "Lottery Main Server HTTP $Port"
}

function Test-LotteryWebFirewallRule {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  return $null -ne (Get-NetFirewallRule -DisplayName (Get-LotteryWebFirewallRuleName -Port $Port) -ErrorAction SilentlyContinue)
}

function Test-PostgresLanConfigRequired {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$ServiceDetails
  )

  $pgHbaPath = Get-PostgresPgHbaPath -ServiceDetails $ServiceDetails
  if (-not $pgHbaPath) {
    return $false
  }

  $rulePattern = '^\s*host\s+all\s+all\s+samenet\s+(scram-sha-256|md5)(\s|$)'
  return -not (Select-String -Path $pgHbaPath -Pattern $rulePattern -Quiet)
}

function Ensure-PostgresLanAccess {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$ServiceDetails
  )

  $pgHbaPath = Get-PostgresPgHbaPath -ServiceDetails $ServiceDetails
  if (-not $pgHbaPath) {
    throw "pg_hba.conf path could not be resolved from PostgreSQL service settings."
  }

  if (-not (Test-PostgresLanConfigRequired -ServiceDetails $ServiceDetails)) {
    return
  }

  Write-Host "[main-server] enabling PostgreSQL LAN access for same subnet clients"
  Add-Content -LiteralPath $pgHbaPath -Value @(
    "",
    "# Added by Lottery Main Server launcher for LAN terminal/client access",
    "host    all             all             samenet                 scram-sha-256"
  ) -Encoding ascii

  if ($ServiceDetails.PgCtlPath -and (Test-Path -LiteralPath $ServiceDetails.PgCtlPath)) {
    & $ServiceDetails.PgCtlPath reload -D $ServiceDetails.DataDirectory | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "PostgreSQL configuration reload failed after pg_hba.conf update."
    }
    return
  }

  Restart-Service -Name $ServiceDetails.Name -Force
}

function Test-PostgresListenAddressesRequired {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$ServiceDetails
  )

  $confPath = Get-PostgresConfPath -ServiceDetails $ServiceDetails
  if (-not $confPath) {
    return $false
  }

  $content = Get-Content -LiteralPath $confPath -Raw
  $listenLine = ($content -split "`n" | Where-Object {
    $_ -match '^\s*listen_addresses\s*='
  }) | Select-Object -First 1

  if (-not $listenLine) {
    return $true
  }

  $value = if ($listenLine -match "=\s*'([^']*)'") {
    $Matches[1]
  } elseif ($listenLine -match "=\s*(\S+)") {
    $Matches[1]
  } else {
    ""
  }

  return $value.Trim("'""` ").ToLowerInvariant() -eq "localhost"
}

function Ensure-PostgresListenAddresses {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$ServiceDetails
  )

  $confPath = Get-PostgresConfPath -ServiceDetails $ServiceDetails
  if (-not $confPath) {
    Write-Host "[main-server] WARNING: postgresql.conf not found; Postgres may not accept LAN connections"
    return
  }

  $content = Get-Content -LiteralPath $confPath -Raw
  $pattern = '(?m)^\s*listen_addresses\s*=.*$'
  if ($content -match $pattern) {
    $content = [regex]::Replace($content, $pattern, "listen_addresses = '*'")
  } else {
    $content = $content.TrimEnd() + [Environment]::NewLine + "listen_addresses = '*'" + [Environment]::NewLine
  }
  Set-Content -LiteralPath $confPath -Value $content -Encoding ascii -NoNewline

  Write-Host "[main-server] set listen_addresses = '*' in postgresql.conf"

  if ($ServiceDetails.PgCtlPath -and (Test-Path -LiteralPath $ServiceDetails.PgCtlPath)) {
    Write-Host "[main-server] restarting PostgreSQL to apply listen_addresses"
    & $ServiceDetails.PgCtlPath stop -D $ServiceDetails.DataDirectory -m fast 2>$null
    Start-Sleep -Seconds 2
    & $ServiceDetails.PgCtlPath start -D $ServiceDetails.DataDirectory -w -t 30 2>$null
    if ($LASTEXITCODE -ne 0) {
      Start-Service -Name $ServiceDetails.Name -ErrorAction SilentlyContinue
    }
  } else {
    Restart-Service -Name $ServiceDetails.Name -Force
    Start-Sleep -Seconds 3
  }
}

function Ensure-PostgresFirewallRule {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  $ruleName = Get-LotteryPostgresFirewallRuleName -Port $Port
  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($existing) {
    return
  }

  Write-Host "[main-server] adding firewall rule for PostgreSQL on port $Port (LAN only)"
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort $Port `
    -RemoteAddress LocalSubnet `
    -Profile @("Private", "Public") | Out-Null
}

function Get-LotteryPostgresFirewallRuleName {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  return "Lottery PostgreSQL TCP $Port"
}

function Test-PostgresFirewallRule {
  param(
    [Parameter(Mandatory = $true)]
    [int]$Port
  )

  return $null -ne (Get-NetFirewallRule -DisplayName (Get-LotteryPostgresFirewallRuleName -Port $Port) -ErrorAction SilentlyContinue)
}

function Get-PostgresConfPath {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$ServiceDetails
  )

  if (-not $ServiceDetails.DataDirectory) {
    return $null
  }

  $confPath = Join-Path $ServiceDetails.DataDirectory "postgresql.conf"
  if (Test-Path -LiteralPath $confPath) {
    return $confPath
  }

  return $null
}

function Get-PostgresPgHbaPath {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$ServiceDetails
  )

  if (-not $ServiceDetails.DataDirectory) {
    return $null
  }

  $pgHbaPath = Join-Path $ServiceDetails.DataDirectory "pg_hba.conf"
  if (Test-Path -LiteralPath $pgHbaPath) {
    return $pgHbaPath
  }

  return $null
}

function Test-IsAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Is-LocalHost {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ServerHost
  )

  $normalized = $ServerHost.Trim().ToLowerInvariant()
  return $normalized -in @("127.0.0.1", "localhost", "::1", $env:COMPUTERNAME.ToLowerInvariant())
}

function Test-TcpPort {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ServerHost,
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [Parameter(Mandatory = $false)]
    [int]$TimeoutMs = 1000
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $asyncResult = $client.BeginConnect($ServerHost, $Port, $null, $null)
    if (-not $asyncResult.AsyncWaitHandle.WaitOne($TimeoutMs, $false)) {
      return $false
    }

    $client.EndConnect($asyncResult)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Wait-ForTcpPort {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ServerHost,
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [Parameter(Mandatory = $true)]
    [int]$TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-TcpPort -ServerHost $ServerHost -Port $Port) {
      return
    }
    Start-Sleep -Seconds 1
  }

  throw "Postgres did not become reachable at $ServerHost`:$Port within $TimeoutSeconds seconds."
}

Invoke-Main
