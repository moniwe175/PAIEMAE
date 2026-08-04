@echo off
title Sistema Marketing - Clinica Evelyn
color 0A

echo.
echo ================================================
echo   Sistema de Marketing - Clinica Evelyn
echo ================================================
echo.
echo Iniciando os dois servicos...
echo.

:: Verificar se worker_whatsapp existe
if not exist "%~dp0worker_whatsapp\index.js" (
    color 0C
    echo ERRO: Pasta worker_whatsapp nao encontrada!
    echo Certifique-se que este arquivo esta na pasta raiz do projeto PAIEMAE
    pause
    exit /b 1
)

:: Verificar se marketing_engine existe
if not exist "%~dp0marketing_engine\main.py" (
    color 0C
    echo ERRO: Pasta marketing_engine nao encontrada!
    echo Certifique-se que este arquivo esta na pasta raiz do projeto PAIEMAE
    pause
    exit /b 1
)

echo [1/2] Iniciando Worker WhatsApp...
start "Worker WhatsApp - Clinica Evelyn" cmd /k "cd /d %~dp0worker_whatsapp && color 0A && echo. && echo ================================================ && echo   Worker WhatsApp - Clinica Evelyn && echo ================================================ && echo. && echo Aguarde conectar ao WhatsApp... && echo Abra o site em Integracoes Motor Marketing && echo para escanear o QR Code se necessario. && echo. && echo NAO FECHE esta janela! && echo. && npm start"

echo [2/2] Iniciando Engine Python...
start "Engine Marketing - Clinica Evelyn" cmd /k "cd /d %~dp0marketing_engine && color 0B && echo. && echo ================================================ && echo   Engine Marketing - Clinica Evelyn && echo ================================================ && echo. && echo Processando as 19 ferramentas de marketing... && echo. && echo NAO FECHE esta janela! && echo. && python main.py"

echo.
echo ================================================
echo   Os dois servicos foram iniciados!
echo ================================================
echo.
echo Duas janelas foram abertas:
echo   - VERDE: Worker WhatsApp
echo   - AZUL:  Engine Marketing (19 ferramentas)
echo.
echo Pode fechar ESTA janela.
echo NAO feche as outras duas!
echo.
pause
