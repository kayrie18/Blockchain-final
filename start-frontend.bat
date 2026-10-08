@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"

if not exist "%FRONTEND_DIR%" (
  echo Frontend folder not found at "%FRONTEND_DIR%".
  pause
  exit /b 1
)

pushd "%FRONTEND_DIR%"

if exist "%ProgramFiles%\nodejs\npm.cmd" (
  set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
) else if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" (
  set "NPM_CMD=%ProgramFiles(x86)%\nodejs\npm.cmd"
) else (
  echo Node.js/npm was not found in the default install path.
  pause
  exit /b 1
)

echo Installing frontend dependencies...
call "%NPM_CMD%" install

echo Starting frontend in dev mode...
call "%NPM_CMD%" run dev

popd
pause
