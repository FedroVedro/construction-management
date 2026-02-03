@echo off
chcp 65001 > nul
echo Checking git status...
git status
echo.
echo Adding all files...
git add .
echo.
echo Committing merge...
git commit -m "Merge branch 'master' of https://github.com/FedroVedro/construction-management"
echo.
echo Checking final status...
git status
echo.
echo Merge completion attempt finished.
pause
