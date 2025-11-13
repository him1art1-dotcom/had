@echo off
set PORT=%1
if "%PORT%"=="" set PORT=5500
python -m http.server %PORT%
