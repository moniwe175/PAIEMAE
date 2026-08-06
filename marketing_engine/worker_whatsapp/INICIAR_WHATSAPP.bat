@echo off
title Worker WhatsApp - Clinica Evelyn
color 0A

echo.
echo ================================================
echo   Worker WhatsApp - Clinica Evelyn
echo ================================================
echo.
echo Iniciando conexao com WhatsApp...
echo.
echo IMPORTANTE:
echo  1. Abra o sistema no navegador
echo  2. Va em Integracoes - Motor Marketing
echo  3. O QR Code aparecera la automaticamente
echo  4. Escaneie com o celular da clinica
echo.
echo ------------------------------------------------
echo  NAO FECHE esta janela enquanto usar o sistema!
echo  Pode minimizar, mas nao fechar.
echo ------------------------------------------------
echo.

cd /d "%~dp0"

node index.js

echo.
color 0C
echo O worker foi encerrado.
echo Se foi sem querer, clique duas vezes em
echo INICIAR_WHATSAPP.bat novamente.
echo.
pause
