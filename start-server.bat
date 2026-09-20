@echo off
set "NODE_PATH=C:\Users\arjit\nodejs\node-v22.16.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"

echo ============================================================
echo   North Wide Traders - Starting Web Server ^& Admin Panel
echo ============================================================
echo.

node server.js
pause
