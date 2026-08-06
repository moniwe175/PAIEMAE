@echo off
title Instalacao Worker WhatsApp - Clinica Evelyn
color 0A

echo.
echo ================================================
echo   Instalacao Worker WhatsApp - Clinica Evelyn
echo ================================================
echo.

cd /d "%~dp0"

:: Verificar se index.js e package.json estao na mesma pasta
if not exist "index.js" (
    color 0C
    echo.
    echo ERRO: Arquivo index.js nao encontrado nesta pasta!
    echo.
    echo Este arquivo INSTALAR_UMA_VEZ.bat precisa estar
    echo na mesma pasta que o index.js e package.json.
    echo.
    echo Pasta atual: %~dp0
    echo.
    echo Solucao: Mova todos os arquivos para a mesma pasta
    echo e execute novamente.
    echo.
    pause
    exit /b 1
)

if not exist "package.json" (
    color 0C
    echo.
    echo ERRO: Arquivo package.json nao encontrado nesta pasta!
    echo.
    echo Este arquivo INSTALAR_UMA_VEZ.bat precisa estar
    echo na mesma pasta que o index.js e package.json.
    echo.
    echo Pasta atual: %~dp0
    echo.
    pause
    exit /b 1
)

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo.
    echo ERRO: Node.js nao encontrado!
    echo Instale em: https://nodejs.org e tente novamente.
    echo.
    pause
    exit /b 1
)
echo     OK - Node.js ja instalado.
echo.

echo [2/4] Verificando dependencias...
if exist "node_modules\" (
    echo     OK - Dependencias ja instaladas, pulando.
) else (
    echo     Instalando dependencias, aguarde 1-2 minutos...
    call npm install
    if errorlevel 1 (
        color 0C
        echo.
        echo ERRO ao instalar dependencias.
        echo Entre em contato com o suporte tecnico.
        echo.
        pause
        exit /b 1
    )
    echo     OK - Dependencias instaladas!
)
echo.

echo [3/4] Verificando configuracoes...
if exist ".env" (
    echo     OK - Arquivo .env ja existe, pulando.
) else (
    echo     Criando arquivo .env...
    (
        echo SUPABASE_URL=https://ecwizjyflxcickbfzhcp.supabase.co
        echo SUPABASE_SERVICE_KEY=COLOQUE_A_CHAVE_AQUI
        echo AUTH_FOLDER=./sessao_whatsapp
        echo POLL_INTERVAL_MS=30000
        echo MAX_EXPIRY_LAG_MS=3600000
    ) > .env
    color 0E
    echo.
    echo     ATENCAO: Preencha SUPABASE_SERVICE_KEY no arquivo .env
    echo     antes de usar o sistema!
    echo.
    color 0A
)
echo.

echo [4/4] Verificando sessao WhatsApp...
if exist "sessao_whatsapp\" (
    echo     OK - Sessao anterior encontrada.
) else (
    echo     Nenhuma sessao anterior - escaneie o QR Code na 1a vez.
)
echo.

echo Configurando inicio automatico com Windows...
set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
if exist "%STARTUP%\Worker WhatsApp Clinica.bat" (
    echo     OK - Inicio automatico ja configurado, pulando.
) else (
    copy "%~dp0INICIAR_WHATSAPP.bat" "%STARTUP%\Worker WhatsApp Clinica.bat" >nul 2>&1
    if exist "%STARTUP%\Worker WhatsApp Clinica.bat" (
        echo     OK - Configurado para iniciar com o Windows.
    ) else (
        echo     Aviso: Nao foi possivel configurar inicio automatico.
    )
)
echo.

echo ================================================
echo   PRONTO! Instalacao concluida com sucesso.
echo ================================================
echo.
echo Proximo passo:
echo   Clique duas vezes em INICIAR_WHATSAPP.bat
echo   para conectar o WhatsApp.
echo.
pause
