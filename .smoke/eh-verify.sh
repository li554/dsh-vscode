#!/bin/bash
# Reproduce the exact failing environment: VS Code Electron-as-Node runtime,
# fresh DSH_HOME (like the extension's globalStorage), --expose-internals.
CODE="C:/Users/li554/AppData/Local/Programs/Microsoft VS Code/Code.exe"
ROOT="D:/PycharmProjects/Work/dsh-vscode"
FRESH="C:/Users/li554/AppData/Local/Temp/dsh-fresh-home"
rm -rf "$FRESH"
cd "$ROOT" || exit 1
DSH_HOME="$FRESH" ELECTRON_RUN_AS_NODE=1 "$CODE" --expose-internals   vendor/node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --port 0 --no-open   > .smoke/eh-verify.log 2>&1 &
PID=$!
PORT=""
for i in $(seq 1 60); do
  PORT=$(grep -oE 'dsh web: http://127.0.0.1:[0-9]+' .smoke/eh-verify.log 2>/dev/null | grep -oE '[0-9]+$' | head -1)
  [ -n "$PORT" ] && break
  kill -0 $PID 2>/dev/null || break
  sleep 2
done
echo "PORT=$PORT"
if [ -n "$PORT" ]; then
  C1=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1:$PORT/")
  C2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST -H "Content-Type: application/json" --data '{"rpcId":"v1","method":"session.list","payload":{}}' "http://127.0.0.1:$PORT/api/session.list")
  echo "root=$C1 api-clean=$C2"
else
  echo "BOOT FAILED"; tail -12 .smoke/eh-verify.log
fi
kill $PID 2>/dev/null
rm -rf "$FRESH"
echo DONE
