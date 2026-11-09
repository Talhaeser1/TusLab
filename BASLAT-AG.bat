@echo off
setlocal
cd /d "%~dp0"
echo.
echo  TUSLAB PVP - YEREL AG (diger bilgisayarlar baglanabilir)
echo.
where npm >nul 2>&1
if errorlevel 1 (
 echo HATA: Node.js ve npm bulunamadi.
 pause
 exit /b 1
)
echo Diger bilgisayarda Brave'de su adreslerden birini acin:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "169.254"') do for /f "tokens=*" %%b in ("%%a") do echo    http://%%b:8787/
echo (Iki bilgisayar ayni Wi-Fi aginda olmali.)
echo.
echo Windows Guvenlik Duvari sorarsa "Erisime izin ver" deyin.
echo Bu pencereyi kapatmayin.
echo.
call npm run cf:dev:lan
pause
