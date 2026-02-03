@echo off
git status
echo.
echo === Checking merge files ===
if exist .git\MERGE_HEAD (
    echo MERGE_HEAD exists
) else (
    echo MERGE_HEAD does not exist
)
