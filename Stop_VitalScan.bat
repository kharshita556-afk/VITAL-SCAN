@echo off
title Stop VitalScan Server
echo Stopping VitalScan background server...

:: Kill the pythonw process
taskkill /f /im pythonw.exe >nul 2>&1

echo.
echo VitalScan Server stopped successfully.
echo.
timeout /t 3 >nul
exit
