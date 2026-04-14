@echo off
setlocal
title Lottery Cache Cleanup
if /I "%~1"=="--with-node_modules" (
  powershell -ExecutionPolicy Bypass -File "%~dp0..\scripts\clean-cache.ps1" -IncludeNodeModules
) else (
  powershell -ExecutionPolicy Bypass -File "%~dp0..\scripts\clean-cache.ps1"
)
if errorlevel 1 (
  echo.
  echo Cache cleanup failed.
  pause
)
