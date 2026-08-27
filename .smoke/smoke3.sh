#!/bin/bash
cd "D:/PycharmProjects/Work/dsh-vscode/.smoke/installed/extension" || exit 1
export DSH_HOME="D:/PycharmProjects/Work/dsh-vscode/.smoke/home"
node vendor/@deepseek-ai/dsh/lib/bin.js --profile web --port 0 --no-open > ../installed-host.log 2>&1 &
PID=$!
PORT=""
for i in $(seq 1 60); do
  PORT=$(grep -oE 'dsh web: http://127.0.0.1:[0-9]+' ../installed-host.log 2>/dev/null | grep -oE '[0-9]+$' | head -1)
  [ -n "$PORT" ] && break
  kill -0 $PID 2>/dev/null || break
  sleep 2
done
echo "PORT=$PORT"
if [ -n "$PORT" ]; then
  CODE1=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1:$PORT/")
  CODE2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST -H "Content-Type: application/json" -H "Origin: http://evil.example" -H "Sec-Fetch-Site: cross-site" --data '{}' "http://127.0.0.1:$PORT/api/session.list")
  CODE3=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST -H "Content-Type: application/json" --data '{"rpcId":"smoke-3","method":"session.list","payload":{}}' "http://127.0.0.1:$PORT/api/session.list")
  echo "root=$CODE1 fence-marked=$CODE2 fence-clean=$CODE3"
fi
kill $PID 2>/dev/null
echo DONE
