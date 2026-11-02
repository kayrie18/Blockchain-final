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

if exist "%ProgramFiles%\nodejs\npx.cmd" (
  set "NPX_CMD=%ProgramFiles%\nodejs\npx.cmd"
) else if exist "%ProgramFiles(x86)%\nodejs\npx.cmd" (
  set "NPX_CMD=%ProgramFiles(x86)%\nodejs\npx.cmd"
) else (
  echo npx was not found in the default install path.
  pause
  exit /b 1
)

echo Deploying the Hardhat contract on localhost...
call "%NPX_CMD%" hardhat run scripts/deploy.js --network localhost

popd
pause
