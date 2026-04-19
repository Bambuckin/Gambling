param(
  [switch]$Kiosk
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

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$profileTag = Get-Date -Format "yyyyMMdd-HHmmss"
$profileDir = Join-Path $root ".main-browser-profile-$profileTag"
New-Item -ItemType Directory -Path $profileDir -Force | Out-Null

$browserPath = Resolve-BrowserPath
if (-not $browserPath) {
  throw "Chrome or Edge was not found on this computer."
}

$url = "http://127.0.0.1:3000/login"

if ($Kiosk.IsPresent) {
  Write-Host ""
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "  LOTTERY CASHIER KIOSK (LOCAL)" -ForegroundColor Cyan
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  TO EXIT:  Press Alt+F4" -ForegroundColor Yellow
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host ""

  $browserProcess = Start-Process -FilePath $browserPath -ArgumentList @(
    "--kiosk",
    $url,
    "--user-data-dir=$profileDir",
    "--disable-extensions",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check"
  ) -PassThru

  try {
    $browserProcess.WaitForExit()
    Write-Host "[client] browser closed"
  } catch {
    Write-Host "[client] interrupted"
  }
} else {
  Start-Process -FilePath $browserPath -ArgumentList @(
    "--app=$url",
    "--user-data-dir=$profileDir",
    "--disable-extensions",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    "--start-maximized"
  ) | Out-Null
}
