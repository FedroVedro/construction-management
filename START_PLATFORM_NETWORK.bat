@echo off
setlocal enabledelayedexpansion

REM Получаем IP-адрес
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set "LOCAL_IP=%%a"
    set "LOCAL_IP=!LOCAL_IP:~1!"
    goto :found
)
:found

title Запуск платформы в локальной сети

echo.
echo ================================================
echo   ЗАПУСК ПЛАТФОРМЫ В ЛОКАЛЬНОЙ СЕТИ
echo ================================================
echo.
echo Ваш IP: %LOCAL_IP%
echo Backend: http://%LOCAL_IP%:8000
echo Frontend: http://%LOCAL_IP%:3000
echo.
echo Другие пользователи откроют: http://%LOCAL_IP%:3000
echo ================================================
echo.

REM Создаем .env.local для Frontend
cd /d "%~dp0"
echo REACT_APP_API_URL=http://%LOCAL_IP%:8000/api > frontend\.env.local

REM Запускаем Backend
echo Запуск Backend...
start "Backend Server" cmd /c "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

REM Ждем 5 секунд
ping 127.0.0.1 -n 6 > nul

REM Запускаем Frontend
echo Запуск Frontend...
cd /d "%~dp0frontend"
start "Frontend Server" cmd /c "set HOST=0.0.0.0 && npm start"

echo.
echo ================================================
echo   ПЛАТФОРМА ЗАПУЩЕНА!
echo ================================================
echo.
echo Откройте браузер: http://%LOCAL_IP%:3000
echo.
echo Логин: admin
echo Пароль: admin123
echo.
echo Закройте окна Backend и Frontend для остановки
echo ================================================
echo.
pause
