@echo off
start "" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0scripts\start-office.ps1"
