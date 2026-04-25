param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("web", "worker")]
  [string]$Role,
  [Parameter(Mandatory = $false)]
  [string]$OutputPath = ".env",
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
  [string]$TerminalBrowserUrl = "http://127.0.0.1:9222",
  [Parameter(Mandatory = $false)]
  [string]$TerminalPageUrl = "",
  [Parameter(Mandatory = $false)]
  [switch]$Force
)

function Read-HostsConfig {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $default = @{
    server = @{
      hostname = "0.0.0.0"
      webPort = 3000
    }
    database = @{
      ip = ""
      port = 5432
      dbName = "lottery"
      user = "lottery"
      password = ""
    }
  }

  $fullPath = if ([System.IO.Path]::IsPathRooted($Path)) {
    $Path
  } else {
    Join-Path (Get-Location) $Path
  }

  if (-not (Test-Path -LiteralPath $fullPath)) {
    return $default
  }

  try {
    $json = Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json -AsHashtable
    if ($null -eq $json) {
      return $default
    }

    if ($json.ContainsKey("server")) {
      foreach ($key in @("hostname", "webPort")) {
        if ($json.server.ContainsKey($key)) {
          $default.server[$key] = $json.server[$key]
        }
      }
    }

    if ($json.ContainsKey("database")) {
      foreach ($key in @("ip", "port", "dbName", "user", "password")) {
        if ($json.database.ContainsKey($key)) {
          $default.database[$key] = $json.database[$key]
        }
      }
    }
  } catch {
    throw "Unable to parse hosts config: $fullPath. $($_.Exception.Message)"
  }

  return $default
}

function Assert-RealValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Label,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "$Label is empty. Provide it via parameters or hosts config."
  }

  if ($Value.Contains("<") -and $Value.Contains(">")) {
    throw "$Label still contains placeholder markers: $Value"
  }
}

function Replace-EnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [AllowEmptyString()]
    [string]$Content,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  $escapedKey = [Regex]::Escape($Key)
  $pattern = "(?m)^$escapedKey=.*$"
  $replacement = "$Key=$Value"

  if ([Regex]::IsMatch($Content, $pattern)) {
    return [Regex]::Replace(
      $Content,
      $pattern,
      [System.Text.RegularExpressions.MatchEvaluator] {
        param($m)
        $replacement
      }
    )
  }

  if ($Content.Length -gt 0 -and -not $Content.EndsWith("`n")) {
    return "$Content`r`n$replacement`r`n"
  }

  return "$Content$replacement`r`n"
}

function Build-PostgresUrl {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DbHostName,
    [Parameter(Mandatory = $true)]
    [int]$Port,
    [Parameter(Mandatory = $true)]
    [string]$DbName,
    [Parameter(Mandatory = $true)]
    [string]$User,
    [Parameter(Mandatory = $true)]
    [string]$Password
  )

  $escapedUser = [System.Uri]::EscapeDataString($User)
  $escapedPassword = [System.Uri]::EscapeDataString($Password)
  $escapedDbName = [System.Uri]::EscapeDataString($DbName)
  return "postgresql://$escapedUser`:$escapedPassword@${DbHostName}:$Port/$escapedDbName"
}

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$hostsConfig = Read-HostsConfig -Path $HostsFile

if (-not $PSBoundParameters.ContainsKey("DbHost")) {
  $DbHost = [string]$hostsConfig.database.ip
}
if (-not $PSBoundParameters.ContainsKey("DbPort")) {
  $DbPort = [int]$hostsConfig.database.port
}
if (-not $PSBoundParameters.ContainsKey("DbName")) {
  $DbName = [string]$hostsConfig.database.dbName
}
if (-not $PSBoundParameters.ContainsKey("DbUser")) {
  $DbUser = [string]$hostsConfig.database.user
}
if (-not $PSBoundParameters.ContainsKey("DbPassword")) {
  $DbPassword = [string]$hostsConfig.database.password
}
if ($Role -eq "web") {
  if (-not $PSBoundParameters.ContainsKey("Hostname")) {
    $Hostname = [string]$hostsConfig.server.hostname
  }
  if (-not $PSBoundParameters.ContainsKey("Port")) {
    $Port = [int]$hostsConfig.server.webPort
  }
}

Assert-RealValue -Label "DbHost" -Value $DbHost
Assert-RealValue -Label "DbName" -Value $DbName
Assert-RealValue -Label "DbUser" -Value $DbUser
Assert-RealValue -Label "DbPassword" -Value $DbPassword

if ($Role -eq "web") {
  Assert-RealValue -Label "Hostname" -Value $Hostname
}

$templatePath = if ($Role -eq "web") {
  Join-Path $root "ops/runtime/.env.web.template"
} else {
  Join-Path $root "ops/runtime/.env.worker.template"
}

if (-not (Test-Path -LiteralPath $templatePath)) {
  throw "Template not found: $templatePath"
}

$outputFullPath = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath
} else {
  Join-Path $root $OutputPath
}

if ((Test-Path -LiteralPath $outputFullPath) -and (-not $Force.IsPresent)) {
  throw "Output file already exists: $outputFullPath. Use -Force to overwrite."
}

$template = Get-Content -LiteralPath $templatePath -Raw
$connectionUrl = Build-PostgresUrl -DbHostName $DbHost -Port $DbPort -DbName $DbName -User $DbUser -Password $DbPassword

$content = Replace-EnvValue -Content $template -Key "LOTTERY_POSTGRES_URL" -Value $connectionUrl
$content = Replace-EnvValue -Content $content -Key "LOTTERY_STORAGE_BACKEND" -Value "postgres"

if ($Role -eq "web") {
  $content = Replace-EnvValue -Content $content -Key "HOSTNAME" -Value $Hostname
  $content = Replace-EnvValue -Content $content -Key "PORT" -Value ([string]$Port)
} else {
  $content = Replace-EnvValue -Content $content -Key "LOTTERY_TERMINAL_BROWSER_URL" -Value $TerminalBrowserUrl
  $content = Replace-EnvValue -Content $content -Key "LOTTERY_TERMINAL_PAGE_URL" -Value $TerminalPageUrl
}

$outputDir = Split-Path -Parent $outputFullPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($outputFullPath, $content, $utf8NoBom)

Write-Host "[env] created role=$Role path=$outputFullPath"
Write-Host "[env] db=${DbHost}:${DbPort}/$DbName user=$DbUser"
if ($Role -eq "web") {
  Write-Host "[env] web endpoint=${Hostname}:$Port"
} else {
  Write-Host "[env] terminal browser=$TerminalBrowserUrl"
}
