@echo off
title Sistema da Oficina - Vite
cd /d "%~dp0"

:: Inicia o servidor Vite em uma nova janela de fundo e abre o navegador
start http://localhost:5173/
npm run dev

exit