@echo off
title Fixi
cd /d "%~dp0"
if not exist ".env" (
  echo .env fehlt. Bitte ".env.example" nach ".env" kopieren und ausfuellen.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo Build fehlt. Fuehre einmalig "yarn install" und "yarn build" aus.
  pause
  exit /b 1
)
if not exist "dist-server\index.mjs" (
  echo Server-Build fehlt. Fuehre "yarn build" aus.
  pause
  exit /b 1
)
set OPEN_BROWSER=1
node dist-server\index.mjs
pause
