@echo off
setlocal
title Lottery LAN Bundles
powershell -ExecutionPolicy Bypass -File "%~dp0..\scripts\build-lan-bundles.ps1"
if errorlevel 1 (
  echo.
  echo LAN bundle build failed.
  pause
)
