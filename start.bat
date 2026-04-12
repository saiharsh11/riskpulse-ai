@echo off
echo Starting RiskPulse AI...
echo.

start "RiskPulse Backend" cmd /k "cd /d %~dp0backend && py -3.9 -m uvicorn main:app --reload --port 8001"

timeout /t 3 /nobreak >nul

start "RiskPulse Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend  -> http://localhost:8001
echo Frontend -> http://localhost:3000
echo.
echo Both servers are starting in separate windows...
pause
