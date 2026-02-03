@echo off
chcp 65001 >nul

REM Автоматическое определение IP-адреса
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    goto :found
)
:found
set LOCAL_IP=%LOCAL_IP:~1%

echo ================================================
echo Настройка Frontend для локальной сети
echo ================================================
echo.
echo Ваш IP-адрес: %LOCAL_IP%
echo.

REM Создаем файл .env.local с правильным IP
echo REACT_APP_API_URL=http://%LOCAL_IP%:8000/api > .env.local

echo Файл .env.local создан с адресом: http://%LOCAL_IP%:8000/api
echo.
echo ================================================
echo Запуск Frontend для локальной сети
echo ================================================
echo.
echo Frontend будет доступен по адресу: http://%LOCAL_IP%:3000
echo.
echo Нажмите Ctrl+C для остановки сервера
echo ================================================
echo.

cd /d "%~dp0"
set HOST=0.0.0.0
npm start
