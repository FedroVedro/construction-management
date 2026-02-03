@echo off

REM Простой запуск без автоопределения IP
REM Замените 192.168.1.100 на ваш реальный IP-адрес

set MY_IP=192.168.1.100

echo Создание конфигурации...
cd /d "%~dp0"
echo REACT_APP_API_URL=http://%MY_IP%:8000/api > frontend\.env.local

echo Запуск Backend...
start "Backend" cmd /k "cd /d "%~dp0backend" && venv\Scripts\activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

echo Ожидание...
ping 127.0.0.1 -n 6 > nul

echo Запуск Frontend...
cd /d "%~dp0frontend"
start "Frontend" cmd /k "npm start"

echo.
echo Откройте браузер: http://%MY_IP%:3000
echo Логин: admin / Пароль: admin123
echo.
pause
