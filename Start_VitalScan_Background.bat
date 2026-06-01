@echo off
title VitalScan Background Starter
echo Starting VitalScan Server in background...

:: Enter the directory
cd /d "c:\Users\RAVI\Desktop\MY PROJECTS\VITAL SCAN"

:: Run Flask silently without keeping any command prompt open
start "" pythonw app.py

:: Give the server 2 seconds to initialize
timeout /t 2 /nobreak >nul

:: Automatically launch the portal in the user's default browser
start http://127.0.0.1:5000

echo.
echo VitalScan is now running in the background!
echo You can close this window now.
echo.
timeout /t 3 >nul
exit
