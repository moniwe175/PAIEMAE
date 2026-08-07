@echo off
title Sistema Marketing - Clinica Evelyn
color 0A

echo.
echo ================================================
echo   Sistema de Marketing - Clinica Evelyn
echo ================================================
echo.

:: 1. DEFINIR PASTA RAIZ DO PROJETO (BUSCA AUTOMATICA MULTI-PASTAS)
set "BASE_DIR=%~dp0"

for %%D in (
    "%BASE_DIR%"
    "%BASE_DIR%iury1\"
    "%BASE_DIR%paiemae\"
    "%BASE_DIR%PAIEMAE-main\"
    "%USERPROFILE%\Desktop\iury1\"
    "%USERPROFILE%\Desktop\paiemae\"
    "%USERPROFILE%\Desktop\PAIEMAE-main\"
    "%USERPROFILE%\Desktop\iury\paiemae\"
    "%USERPROFILE%\Desktop\iury\PAIEMAE\"
    "%USERPROFILE%\Downloads\iury1\"
    "%USERPROFILE%\Downloads\paiemae\"
    "%USERPROFILE%\Downloads\PAIEMAE-main\"
    "%USERPROFILE%\Documents\iury1\"
    "%USERPROFILE%\Documents\paiemae\"
    "%USERPROFILE%\Documents\PAIEMAE-main\"
) do (
    if exist "%%~fDworker_whatsapp\index.js" (
        set "BASE_DIR=%%~fD"
        goto :FOUND
    )
)

color 0C
echo ========================================================
echo ERRO: Pasta "worker_whatsapp" NAO encontrada!
echo ========================================================
echo O arquivo .bat esta em: %~dp0
echo.
echo COMO RESOLVER:
echo Mova ou copie este arquivo INICIAR_SISTEMA_MARKETING.bat
echo para DENTRO da pasta do seu projeto (onde ficam as pastas
echo worker_whatsapp e marketing_engine).
echo ========================================================
echo.
pause
exit /b 1

:FOUND
echo [OK] Pasta do projeto localizada em:
echo "%BASE_DIR%"
echo.

:: 2. GARANTIR ARQUIVO .env NA RAIZ E SUBPASTAS
if not exist "%BASE_DIR%.env" (
    echo [CONFIG] Criando .env com credenciais do Supabase na raiz...
    (
        echo SUPABASE_URL=https://ecwizjyflxcickbfzhcp.supabase.co
        echo SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDAwODUsImV4cCI6MjA5Mjk3NjA4NX0.o6v0_Z0XhIjFhlD8P4MBZN2F9t_ljXq0sJ8ZsvDWQBA
        echo SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDAwODUsImV4cCI6MjA5Mjk3NjA4NX0.o6v0_Z0XhIjFhlD8P4MBZN2F9t_ljXq0sJ8ZsvDWQBA
    ) > "%BASE_DIR%.env"
)
if not exist "%BASE_DIR%worker_whatsapp\.env" copy "%BASE_DIR%.env" "%BASE_DIR%worker_whatsapp\.env" >nul
if not exist "%BASE_DIR%marketing_engine\.env" copy "%BASE_DIR%.env" "%BASE_DIR%marketing_engine\.env" >nul

:: 3. VERIFICAR NODE.JS
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ========================================================
    echo ERRO CRITICO: Node.js NAO esta instalado neste computador!
    echo ========================================================
    echo 1. Baixe em: https://nodejs.org  ^(versao LTS^)
    echo 2. Instale, feche este programa e abra novamente.
    echo ========================================================
    echo.
    pause
    exit /b 1
)

:: 4. VERIFICAR PYTHON
set "PY_OK=0"
where python >nul 2>nul && set "PY_OK=1"
where py >nul 2>nul && set "PY_OK=1"
where python3 >nul 2>nul && set "PY_OK=1"

if "%PY_OK%"=="0" (
    color 0C
    echo ========================================================
    echo ERRO CRITICO: Python NAO esta instalado neste computador!
    echo ========================================================
    echo 1. Baixe em: https://www.python.org/downloads
    echo 2. IMPORTANTE: marque "[X] Add Python to PATH"
    echo 3. Instale, feche esta janela e abra novamente.
    echo ========================================================
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detectado com sucesso!
echo [OK] Python detectado com sucesso!
echo.
echo Iniciando os dois servicos em janelas separadas...
echo Na primeira vez pode demorar mais, pois vai instalar
echo as dependencias automaticamente.
echo.

:: 5. INICIAR WORKER WHATSAPP
start "Worker WhatsApp - Clinica Evelyn" cmd /k "cd /d "%BASE_DIR%worker_whatsapp" && call iniciar_worker.bat"

:: 6. INICIAR ENGINE PYTHON
start "Engine Marketing - Clinica Evelyn" cmd /k "cd /d "%BASE_DIR%marketing_engine" && call iniciar_engine.bat"

echo.
echo ================================================
echo   Os dois servicos foram iniciados!
echo ================================================
echo.
echo Duas janelas foram abertas:
echo   - VERDE: Worker WhatsApp (Node.js)
echo   - AZUL:  Engine Marketing (Python - 19 ferramentas)
echo.
echo Pode fechar ESTA janela principal.
echo NAO feche as duas janelas abertas (Verde e Azul)!
echo.
pause
