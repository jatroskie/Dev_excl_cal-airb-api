@echo off
echo Stopping all Node.js processes...
taskkill /F /IM node.exe
echo.
echo Starting Yi Camera Monitor...
node src/index.js
pause
