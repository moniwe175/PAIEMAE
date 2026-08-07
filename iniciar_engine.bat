@echo off
title Engine Marketing - Clinica Evelyn
color 0B

echo.
echo ================================================
echo   Engine Marketing - Clinica Evelyn
echo ================================================
echo.
echo NAO FECHE esta janela!
echo.

:: 1. DETECTAR COMANDO PYTHON DISPONIVEL
set "PY_CMD="
where python >nul 2>nul && set "PY_CMD=python"
if "%PY_CMD%"=="" (
    where py >nul 2>nul && set "PY_CMD=py"
)
if "%PY_CMD%"=="" (
    where python3 >nul 2>nul && set "PY_CMD=python3"
)

if "%PY_CMD%"=="" (
    color 0C
    echo ERRO: Python nao encontrado. Instale em python.org e marque "Add to PATH".
    pause
    exit /b 1
)

:: 2. GARANTIR .env NESTA PASTA
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

:: 3. VERIFICAR/INSTALAR DEPENDENCIAS DO PYTHON
echo [CHECK] Verificando se os pacotes Python ja estao instalados...
%PY_CMD% -c "import apscheduler" >nul 2>nul
if %errorlevel% neq 0 (
    echo.
    echo [INSTALL] Pacotes do Python ainda nao instalados. Instalando...
    echo Isso pode demorar alguns minutos na primeira vez.
    echo.
    %PY_CMD% -m pip install -r requirements.txt
    if %errorlevel% neq 0 (
        color 0C
        echo.
        echo ========================================================
        echo ERRO: pip install falhou.
        echo Verifique sua conexao com a internet e tente novamente.
        echo ========================================================
        pause
        exit /b 1
    )
    echo [OK] Instalacao concluida!
    echo.
) else (
    echo [OK] Pacotes ja instalados.
    echo.
)

:: 4. INICIAR A ENGINE
echo [START] Processando as 19 ferramentas de marketing...
echo.
%PY_CMD% main.py

:: 5. SE CAIU AQUI, O PROCESSO PAROU/ERROU
color 0C
echo.
echo ========================================================
echo A Engine Marketing parou ou encontrou um erro.
echo Leia a mensagem acima com atencao.
echo.
echo Se o erro mencionar algum modulo ("ModuleNotFoundError"),
echo rode manualmente: %PY_CMD% -m pip install -r requirements.txt
echo ========================================================
echo.
pause
