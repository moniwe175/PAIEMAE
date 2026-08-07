@echo off
title Worker WhatsApp - Clinica Evelyn
color 0A

echo.
echo Abra o site em Integracoes -^> Motor Marketing
echo para escanear o QR Code se necessario.
echo.
echo NAO FECHE esta janela!
echo.

:: 1. GARANTIR .env NESTA PASTA
if not exist ".env" (
    echo [CONFIG] .env nao encontrado aqui, copiando da raiz...
    if exist "..\.env" (
        copy "..\.env" ".env" >nul
    ) else (
        echo [CONFIG] Criando .env com credenciais padrao...
        (
            echo SUPABASE_URL=https://ecwizjyflxcickbfzhcp.supabase.co
            echo SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDAwODUsImV4cCI6MjA5Mjk3NjA4NX0.o6v0_Z0XhIjFhlD8P4MBZN2F9t_ljXq0sJ8ZsvDWQBA
            echo SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjd2l6anlmbHhjaWNrYmZ6aGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDAwODUsImV4cCI6MjA5Mjk3NjA4NX0.o6v0_Z0XhIjFhlD8P4MBZN2F9t_ljXq0sJ8ZsvDWQBA
        ) > ".env"
    )
)

:: 2. VERIFICAR/INSTALAR DEPENDENCIAS DO NODE
if not exist "node_modules\dotenv" (
    echo.
    echo [INSTALL] Pacotes do Node ainda nao instalados. Rodando npm install...
    echo Isso pode demorar alguns minutos na primeira vez.
    echo.
    call npm install
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo ========================================================
        echo ERRO: npm install falhou.
        echo Verifique sua conexao com a internet e tente novamente.
        echo ========================================================
        pause
        exit /b 1
    )
    echo [OK] Instalacao concluida!
    echo.
)

:: 3. INICIAR O WORKER
echo [START] Iniciando Worker WhatsApp...
echo.
call npm start

:: 4. SE CAIU AQUI, O PROCESSO PAROU/ERROU
color 0C
echo.
echo ========================================================
echo O Worker WhatsApp parou ou encontrou um erro.
echo Leia a mensagem acima com atencao.
echo.
echo Se o erro mencionar algum pacote ("Cannot find package"),
echo tente apagar a pasta node_modules e rodar este arquivo de novo.
echo ========================================================
echo.
pause
