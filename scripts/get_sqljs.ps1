$ErrorActionPreference='Stop'
New-Item -ItemType Directory -Path .\lib -Force | Out-Null
Invoke-WebRequest 'https://sql.js.org/dist/sql-wasm.js' -OutFile .\lib\sql-wasm.js
Invoke-WebRequest 'https://sql.js.org/dist/sql-wasm.wasm' -OutFile .\lib\sql-wasm.wasm
