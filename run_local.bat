@echo off
title Lat The Local Server
echo ===================================================
echo   Khoi dong server Lat The (Vercel CLI)
echo   Yeu cau: Da bat Docker Desktop va containers dang chay.
echo ===================================================
echo.
cd /d "%~dp0"
npx vercel dev --listen 5005
pause
