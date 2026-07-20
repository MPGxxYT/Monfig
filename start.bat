@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 goto :error
)

echo Starting Tauri dev app...
call npm run tauri dev
if errorlevel 1 goto :error

goto :eof

:error
echo.
echo Something went wrong. See the output above.
pause
exit /b 1
