@echo off
chcp 65001 >nul

echo ================================================
echo   НАСТРОЙКА И ЗАПУСК В ЛОКАЛЬНОЙ СЕТИ
echo ================================================
echo.

REM Определяем IP автоматически
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :ip_found
)
:ip_found
set IP=%IP:~1%

echo Ваш IP-адрес: %IP%
echo.

REM Создаем конфигурацию Frontend
echo Создание конфигурации...
cd /d "%~dp0frontend"
echo REACT_APP_API_URL=http://%IP%:8000/api > .env.local
echo HOST=0.0.0.0 > .env
echo DANGEROUSLY_DISABLE_HOST_CHECK=true >> .env

echo Конфигурация создана
echo.

REM Запускаем Backend
echo Запуск Backend сервера...
cd /d "%~dp0backend"
start "Backend Server" cmd /k "call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Ожидание запуска Backend (7 секунд)...
ping 127.0.0.1 -n 8 > nul

REM Запускаем Frontend
echo Запуск Frontend сервера...
cd /d "%~dp0frontend"
start "Frontend Server" cmd /k "npm start"

echo.
echo ================================================
echo   ПЛАТФОРМА ЗАПУСКАЕТСЯ!
echo ================================================
echo.
echo Подождите 30-60 секунд пока запустятся серверы
echo.
echo Затем откройте в браузере:
echo   http://%IP%:3000
echo.
echo Другие пользователи в сети откроют:
echo   http://%IP%:3000
echo.
echo Учетные данные:
echo   Логин: admin
echo   Пароль: admin123
echo.
echo ================================================
echo.
pause
