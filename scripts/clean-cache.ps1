param(
  [switch]$IncludeNodeModules
)

$workspaceRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$targets = @(
  (Join-Path $workspaceRoot "apps/web/.next"),
  (Join-Path $workspaceRoot "dist"),
  (Join-Path $workspaceRoot ".tmp-debug"),
  (Join-Path $workspaceRoot "apps/web/tsconfig.tsbuildinfo")
)

$targets += Get-ChildItem -LiteralPath $workspaceRoot -Directory -Filter ".main-browser-profile-*" -ErrorAction SilentlyContinue |
  ForEach-Object { $_.FullName }

if ($IncludeNodeModules) {
  $targets += Join-Path $workspaceRoot "node_modules"
}

$removed = @()

foreach ($target in $targets) {
  if (-not (Test-Path -LiteralPath $target)) {
    continue
  }

  $resolved = (Resolve-Path -LiteralPath $target).Path
  if (-not $resolved.StartsWith($workspaceRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to delete path outside workspace: $resolved"
  }

  $item = Get-Item -LiteralPath $resolved -Force
  if ($item.PSIsContainer) {
    $sizeBytes = (Get-ChildItem -LiteralPath $resolved -Recurse -Force -File -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    Remove-Item -LiteralPath $resolved -Recurse -Force
  } else {
    $sizeBytes = $item.Length
    Remove-Item -LiteralPath $resolved -Force
  }

  $removed += [PSCustomObject]@{
    Path = $resolved.Replace($workspaceRoot + "\", "")
    SizeMB = [math]::Round(($sizeBytes / 1MB), 2)
  }
}

if ($removed.Count -eq 0) {
  Write-Output "Nothing to clean."
  return
}

$removed | Sort-Object Path | Format-Table -AutoSize
$totalMb = [math]::Round((($removed | Measure-Object -Property SizeMB -Sum).Sum), 2)
Write-Output "TOTAL_MB=$totalMb"
