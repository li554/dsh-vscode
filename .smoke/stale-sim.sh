#!/bin/bash
CODE="C:/Users/li554/AppData/Local/Programs/Microsoft VS Code/Code.exe"
ROOT="D:/PycharmProjects/Work/dsh-vscode"
HOME1="C:/Users/li554/AppData/Local/Temp/dsh-stale-sim"
rm -rf "$HOME1"; mkdir -p "$HOME1"
cd "$ROOT" || exit 1

echo "=== step 1: 0.1.3-style boot (no --expose-internals) to leave a broken profile ==="
DSH_HOME="$HOME1" ELECTRON_RUN_AS_NODE=1 "$CODE"   vendor/node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --port 0 --no-open   > .smoke/stale-1.log 2>&1
echo "step1 exit=$? (expect 1)"

echo "=== step 2: 0.1.4-style boot (with --expose-internals) on the SAME home ==="
DSH_HOME="$HOME1" ELECTRON_RUN_AS_NODE=1 "$CODE" --expose-internals   vendor/node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --port 0 --no-open   > .smoke/stale-2.log 2>&1 &
PID=$!
PORT=""
for i in $(seq 1 40); do
  PORT=$(grep -oE 'dsh web: http://127.0.0.1:[0-9]+' .smoke/stale-2.log 2>/dev/null | grep -oE '[0-9]+$' | head -1)
  [ -n "$PORT" ] && break
  kill -0 $PID 2>/dev/null || break
  sleep 2
done
if [ -n "$PORT" ]; then
  echo "step2 OK port=$PORT"
else
  echo "step2 HUNG (no URL line after 80s) - stale profile hang REPRODUCED"
  tail -5 .smoke/stale-2.log
fi
kill $PID 2>/dev/null
rm -rf "$HOME1"
echo DONE
