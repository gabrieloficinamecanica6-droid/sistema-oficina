@echo off
cd /d "%~dp0"

if not exist "node_modules" (
  echo Primeira vez - instalando dependencias, aguarde...
  call npm install
)

start "NAO FECHE - Servidor Gabriel Oficina" cmd /k "npm run dev -- --port 5173"

set tentativas=0
:esperar
set /a tentativas+=1
curl -s -o nul http://localhost:5173
if not errorlevel 1 goto abrir
if %tentativas% GEQ 15 goto abrir
timeout /t 1 /nobreak > nul
goto esperar

:abrir
start "" "http://localhost:5173"
exit
