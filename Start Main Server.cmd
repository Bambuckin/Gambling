@echo off
setlocal
title Lottery Main Server
powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0scripts\start-main-server.ps1"
if errorlevel 1 (
  echo.
  echo Main server start failed.
  pause
)
