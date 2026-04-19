@echo off
setlocal
title Stop Lottery Server
powershell -ExecutionPolicy Bypass -File "%~dp0..\scripts\stop-server.ps1"
pause
