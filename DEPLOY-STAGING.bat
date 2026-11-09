@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo.
echo ===== TUSLAB PVP - STAGING DEPLOY =====
echo Cloudflare hesabiniza test ortami yayinlanacak.
where npm >nul 2>&1
if errorlevel 1 (echo Node.js ve npm kurulu degil. & pause & exit /b 1)
if not exist node_modules\wrangler (
  call npm install
  if errorlevel 1 (echo npm install basarisiz. & pause & exit /b 1)
)
call npm run cf:validate
if errorlevel 1 (echo On kontrol hatasi: deploy iptal. & pause & exit /b 1)
echo Cloudflare girisi yoksa: npx wrangler login
call npm run cf:deploy:staging
if errorlevel 1 (echo Staging yayin hatasi. & pause & exit /b 1)
echo Staging deploy komutu tamamlandi. Site adresini terminalden alarak smoke test yapin.
pause
