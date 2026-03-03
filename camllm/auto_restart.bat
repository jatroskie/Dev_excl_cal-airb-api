@echo off
:loop
echo [Monitor] Starting Camera AI...
call npm start
echo [Monitor] App crashed or stopped. Restarting in 5 seconds...
timeout /t 5
goto loop
