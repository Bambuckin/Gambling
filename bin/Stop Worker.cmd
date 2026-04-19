@echo off
setlocal
title Stop Lottery Worker
powershell -ExecutionPolicy Bypass -File "%~dp0..\scripts\stop-worker.ps1"
pause
