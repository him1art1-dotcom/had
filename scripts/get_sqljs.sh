#!/usr/bin/env bash
set -e
mkdir -p lib
echo 'Downloading sql.js runtime...'
curl -L -o lib/sql-wasm.js https://sql.js.org/dist/sql-wasm.js
curl -L -o lib/sql-wasm.wasm https://sql.js.org/dist/sql-wasm.wasm
echo 'Done.'
