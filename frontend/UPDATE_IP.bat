@echo off
chcp 65001 >nul

echo Определение вашего IP-адреса...
echo.

REM Получаем IP-адрес
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4" ^| findstr /v "127.0.0.1"') do (
    set LOCAL_IP=%%a
    set LOCAL_IP=!LOCAL_IP:~1!
    goto :found
)
:found

echo Ваш IP-адрес: %LOCAL_IP%
echo.

REM Обновляем .env.local
echo REACT_APP_API_URL=http://%LOCAL_IP%:8000/api > .env.local

echo Файл .env.local обновлен!
echo.
echo Теперь ПЕРЕЗАПУСТИТЕ frontend (Ctrl+C и снова npm start)
echo.
pause
