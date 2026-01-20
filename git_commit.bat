@echo off
chcp 65001 > nul
cd /d "d:\Job\Projects\construction-management"

echo === Git Status ===
git status

echo.
echo === Staging all changes ===
git add -A

echo.
echo === Creating commit ===
git commit -m "Fix: Strategic map improvements - cascade delete, year management, optimized column widths"

echo.
echo === Pushing to remote ===
git push

echo.
echo === Done ===
pause
