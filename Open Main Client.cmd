@echo off
setlocal
title Lottery Main Client
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\open-main-client.ps1"
if errorlevel 1 (
  echo.
  echo Main client open failed.
  pause
)
