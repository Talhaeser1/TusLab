@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo ===== TUSLAB PVP - PRODUCTION DEPLOY =====
echo UYARI: Gercek kullanicilarin gorebilecegi Worker guncellenecek.
echo UYARI: Bu islem mevcut verileri yedeklemez; onceden rollback plani kur.
echo ONCE staging ortaminda iki istemcili testi tamamlamalisin.
set /p ANSWER=Devam icin YAYINLA yaz: 
if /I not "%ANSWER%"=="YAYINLA" (echo Iptal edildi. & pause & exit /b 0)
where npm >nul 2>&1
if errorlevel 1 (echo Node.js ve npm kurulu degil. & pause & exit /b 1)
if not exist node_modules\wrangler (
  call npm install
  if errorlevel 1 (echo npm install basarisiz. & pause & exit /b 1)
)
call npm run cf:validate
if errorlevel 1 (echo On kontrol hatasi: deploy iptal. & pause & exit /b 1)
call npm run cf:deploy:production
if errorlevel 1 (echo Production yayin hatasi. & pause & exit /b 1)
echo Production deploy komutu tamamlandi. Canli URL ve canli kullanici kabul testlerini tekrar kontrol et.
pause
