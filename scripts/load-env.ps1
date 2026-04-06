param(
  [Parameter(Mandatory = $false)]
  [string]$Path = ".env"
)

if (-not (Test-Path -LiteralPath $Path)) {
  Write-Host "[env] file not found: $Path"
  return
}

Get-Content -LiteralPath $Path | ForEach-Object {
  $line = $_.Trim()
  if ($line.Length -eq 0) { return }
  if ($line.StartsWith("#")) { return }
  $parts = $line.Split("=", 2)
  if ($parts.Length -ne 2) { return }

  $key = $parts[0].Trim()
  $value = $parts[1]
  if ($key.Length -eq 0) { return }

  [Environment]::SetEnvironmentVariable($key, $value, "Process")
}

Write-Host "[env] loaded from $Path"
