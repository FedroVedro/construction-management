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
echo Запуск Backend сервера для локальной сети
echo ================================================
echo.
echo Ваш IP-адрес: %LOCAL_IP%
echo Backend будет доступен по адресу: http://%LOCAL_IP%:8000
echo Документация API: http://%LOCAL_IP%:8000/docs
echo.
echo Нажмите Ctrl+C для остановки сервера
echo ================================================
echo.

cd /d "%~dp0"
call venv\Scripts\activate.bat
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
