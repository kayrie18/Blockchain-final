@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"

if not exist "%BACKEND_DIR%" (
  echo Backend folder not found at "%BACKEND_DIR%".
  pause
  exit /b 1
)

pushd "%BACKEND_DIR%"

if not exist .env (
  (
    echo MONGODB_URI=mongodb://127.0.0.1:27017/bbdivs
    echo JWT_SECRET=supersecretchangeinproduction
    echo PORT=5000
    echo INITIAL_ADMIN_EMAIL=admin@test.com
    echo INITIAL_ADMIN_PASSWORD=admin123
    echo ETH_RPC_URL=http://127.0.0.1:8545
    echo ETH_CHAIN_ID=31337
    echo DOC_INTEGRITY_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
    echo SIGNING_PRIVATE_KEY=
    echo STORAGE_ENCRYPTION_KEY=
  ) > .env
  echo Created .env with local development defaults.
)

if exist "%ProgramFiles%\nodejs\npm.cmd" (
  set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
) else if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" (
  set "NPM_CMD=%ProgramFiles(x86)%\nodejs\npm.cmd"
) else (
  echo Node.js/npm was not found in the default install path.
  echo Install Node.js LTS from https://nodejs.org/ and reopen this terminal.
  pause
  popd
  exit /b 1
)

echo Installing backend dependencies...
call "%NPM_CMD%" install

echo Starting backend in development mode...
call "%NPM_CMD%" run dev

popd
pause
