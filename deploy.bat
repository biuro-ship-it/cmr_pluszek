@echo off
title CRM Pluszek Deploy
setlocal

set SSH_USER=Pluszek
set SSH_HOST=s61.mydevil.net
set SSH_KEY=%USERPROFILE%\.ssh\id_rsa_pluszek
set DOMAIN=crm.pluszek.pl
set REMOTE_ROOT=/usr/home/Pluszek/domains/crm.pluszek.pl/public_nodejs
set LOCAL_ROOT=%~dp0
if "%LOCAL_ROOT:~-1%"=="\" set LOCAL_ROOT=%LOCAL_ROOT:~0,-1%

echo.
echo  =========================================
echo   CRM Pluszek - Deploy na crm.pluszek.pl (S61)
echo  =========================================
echo.

:: ── [1/7] Build frontendu (Vite -> frontend\dist) ──────────────────────────
echo [1/7] Budowanie frontendu...
cd /d %LOCAL_ROOT%\frontend
if not exist node_modules (
    echo  Instalowanie zaleznosci npm ^(frontend^)...
    call npm install
    if errorlevel 1 ( echo BLAD: npm install frontend nie powiodl sie! & pause & exit /b 1 )
)
call npm run build
if errorlevel 1 ( echo BLAD: npm run build frontend nie powiodl sie! & pause & exit /b 1 )
echo  Frontend OK
echo.

:: ── [2/7] Build backendu (tsc -> backend\dist) ─────────────────────────────
echo [2/7] Budowanie backendu...
cd /d %LOCAL_ROOT%\backend
if not exist node_modules (
    echo  Instalowanie zaleznosci npm ^(backend^)...
    call npm install
    if errorlevel 1 ( echo BLAD: npm install backend nie powiodl sie! & pause & exit /b 1 )
)
call npm run build
if errorlevel 1 ( echo BLAD: npm run build backend nie powiodl sie! & pause & exit /b 1 )
echo  Backend OK
echo.

:: ── [3/7] Deploy frontendu -> public_nodejs/public/ ────────────────────────
:: Czyscimy CALA zawartosc public/ OPROCZ uploads/ (pliki uzytkownika!), potem
:: rozpakowujemy swiezy build. Vite-PWA generuje zahaszowane pliki takze w
:: korzeniu public/ (sw.js, workbox-<hash>.js) - dlatego nie czyscimy samego assets/.
echo [3/7] Wgrywanie frontendu na serwer...
cd /d %LOCAL_ROOT%\frontend
tar czf dist.tar.gz -C dist .
if errorlevel 1 ( echo BLAD: pakowanie frontend\dist nie powiodlo sie! & pause & exit /b 1 )
scp -i "%SSH_KEY%" dist.tar.gz %SSH_USER%@%SSH_HOST%:~/fe-dist.tar.gz
if errorlevel 1 ( echo BLAD: SCP frontendu nie powiodl sie! & del dist.tar.gz 2>nul & pause & exit /b 1 )
del dist.tar.gz 2>nul
ssh -i "%SSH_KEY%" %SSH_USER%@%SSH_HOST% "mkdir -p %REMOTE_ROOT%/public/uploads && find %REMOTE_ROOT%/public -mindepth 1 -maxdepth 1 ! -name uploads -exec rm -rf {} + 2>/dev/null; tar xzf ~/fe-dist.tar.gz -C %REMOTE_ROOT%/public/ && rm -f ~/fe-dist.tar.gz"
if errorlevel 1 ( echo BLAD: rozpakowanie frontendu na serwerze nie powiodlo sie! & pause & exit /b 1 )
echo  Frontend wgrany OK
echo.

:: ── [4/7] Deploy backendu -> public_nodejs/dist/ ───────────────────────────
:: dist/ to czysty wynik kompilacji - czyscimy go w calosci, zeby usuniety lub
:: przemianowany modul nie zostal jako stary plik (pulapka 3 ze skilla mydevil).
echo [4/7] Wgrywanie backendu (dist) na serwer...
cd /d %LOCAL_ROOT%\backend
tar czf dist.tar.gz -C dist .
if errorlevel 1 ( echo BLAD: pakowanie backend\dist nie powiodlo sie! & pause & exit /b 1 )
scp -i "%SSH_KEY%" dist.tar.gz %SSH_USER%@%SSH_HOST%:~/be-dist.tar.gz
if errorlevel 1 ( echo BLAD: SCP backendu nie powiodl sie! & del dist.tar.gz 2>nul & pause & exit /b 1 )
del dist.tar.gz 2>nul
ssh -i "%SSH_KEY%" %SSH_USER%@%SSH_HOST% "rm -rf %REMOTE_ROOT%/dist && mkdir -p %REMOTE_ROOT%/dist && tar xzf ~/be-dist.tar.gz -C %REMOTE_ROOT%/dist/ && rm -f ~/be-dist.tar.gz"
if errorlevel 1 ( echo BLAD: rozpakowanie backendu na serwerze nie powiodlo sie! & pause & exit /b 1 )
echo  Backend wgrany OK
echo.

:: ── [5/7] Deploy package.json + app.js (entry Passengera) ──────────────────
echo [5/7] Wgrywanie package.json i app.js...
scp -i "%SSH_KEY%" "%LOCAL_ROOT%\backend\package.json" "%LOCAL_ROOT%\backend\src\app.js" %SSH_USER%@%SSH_HOST%:%REMOTE_ROOT%/
if errorlevel 1 ( echo BLAD: SCP package.json/app.js nie powiodl sie! & pause & exit /b 1 )
echo  OK
echo.

:: ── [6/7] npm install (prod) + restart Passengera ──────────────────────────
echo [6/7] npm install (prod) i restart aplikacji na serwerze...
ssh -i "%SSH_KEY%" %SSH_USER%@%SSH_HOST% "cd %REMOTE_ROOT% && npm install --omit=dev && devil www restart %DOMAIN%"
if errorlevel 1 ( echo BLAD: npm install / restart na serwerze nie powiodl sie! & pause & exit /b 1 )
echo  OK
echo.

:: ── [7/7] Health check ─────────────────────────────────────────────────────
echo [7/7] Health check (https://%DOMAIN%/health)...
timeout /t 10 /nobreak >nul
curl -f https://%DOMAIN%/health
if errorlevel 1 (
    echo.
    echo  UWAGA: health check nie przeszedl. Sprawdz log:
    echo    ssh -i "%SSH_KEY%" %SSH_USER%@%SSH_HOST% "tail -n 40 ~/domains/%DOMAIN%/logs/error.log"
    pause
    exit /b 1
)
echo.
echo  =========================================
echo   Deploy zakonczony! https://%DOMAIN%
echo  =========================================
echo.
pause
endlocal
