@echo off
chcp 65001 >nul
cd /d "%~dp0"
title TusLab - Neon Arena - PvP Is Paketi 13
set "PORT=5176"
echo.
echo ============================================
echo   TUSLAB NEON ARENA - PVP IS PAKETI 13
 echo ============================================
echo.
echo Bu pencereyi kapatma. Acilis adresi:
echo http://127.0.0.1:%PORT%/index.html
echo.
where py >nul 2>&1
if %errorlevel%==0 (
  start "TusLab Sunucu" cmd /k "py -3 -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/index.html"
  exit /b
)
where python >nul 2>&1
if %errorlevel%==0 (
  start "TusLab Sunucu" cmd /k "python -m http.server %PORT% --bind 127.0.0.1"
  timeout /t 2 /nobreak >nul
  start "" "http://127.0.0.1:%PORT%/index.html"
  exit /b
)
echo Python bulunamadi. Lutfen Python kur ve yeniden dene.
pause
