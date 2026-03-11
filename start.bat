@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Start Electron frontend (Python backend will be started by main.js)
npm start
