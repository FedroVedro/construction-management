@echo off
chcp 65001 >nul
echo ================================================
echo Запуск Backend сервера
echo ================================================
echo.
echo Backend будет доступен по адресу: http://localhost:8000
echo Документация API: http://localhost:8000/docs
echo.
echo Нажмите Ctrl+C для остановки сервера
echo ================================================
echo.

cd /d "%~dp0"
call venv\Scripts\activate.bat
uvicorn app.main:app --reload --port 8000
