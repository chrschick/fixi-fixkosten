@echo off
title Fixi
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo Build fehlt. Fuehre einmalig "yarn install" und "yarn build" aus.
  pause
  exit /b 1
)
node server.mjs
