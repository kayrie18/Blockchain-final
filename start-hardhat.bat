@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "HARDHAT_DIR=%SCRIPT_DIR%hardhat-example"

if not exist "%HARDHAT_DIR%" (
  echo Hardhat project folder not found at "%HARDHAT_DIR%".
  pause
  exit /b 1
)

pushd "%HARDHAT_DIR%"

if exist "%ProgramFiles%\nodejs\npm.cmd" (
  set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
) else if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" (
  set "NPM_CMD=%ProgramFiles(x86)%\nodejs\npm.cmd"
) else (
  echo Node.js/npm was not found in the default install path.
  pause
  exit /b 1
)

if exist "%ProgramFiles%\nodejs\npx.cmd" (
  set "NPX_CMD=%ProgramFiles%\nodejs\npx.cmd"
) else if exist "%ProgramFiles(x86)%\nodejs\npx.cmd" (
  set "NPX_CMD=%ProgramFiles(x86)%\nodejs\npx.cmd"
) else (
  echo npx was not found in the default install path.
  pause
  exit /b 1
)

echo Installing Hardhat dependencies...
call "%NPM_CMD%" install

echo Starting local Hardhat node...
call "%NPX_CMD%" hardhat node

popd
pause
