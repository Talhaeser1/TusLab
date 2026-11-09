@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo  TUSLAB PVP - CLOUDFLARE YEREL TEST - FAZ 20
where npm >nul 2>&1
if errorlevel 1 (
 echo HATA: Node.js ve npm bulunamadi. https://nodejs.org/ adresinden Node.js LTS kurun.
 pause
 exit /b 1
)
if not exist node_modules\wrangler (
 echo Wrangler yukleniyor. Internet baglantisi gerekiyor...
 call npm install
 if errorlevel 1 (echo npm install hatasi.& pause & exit /b 1)
)
echo.
echo Ardindan Brave'de http://127.0.0.1:8787/ adresine girin.
echo Bu pencereyi kapatmayin.
call npm run cf:dev
pause
