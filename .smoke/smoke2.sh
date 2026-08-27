#!/bin/bash
cd "D:/PycharmProjects/Work/dsh-vscode" || exit 1
export DSH_HOME="D:/PycharmProjects/Work/dsh-vscode/.smoke/home"
node node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --port 0 --no-open > .smoke/host2.log 2>&1 &
PID=$!
PORT=""
for i in $(seq 1 60); do
  [ -f .smoke/host2.log ] && PORT=$(grep -oE 'dsh web: http://127.0.0.1:[0-9]+' .smoke/host2.log | grep -oE '[0-9]+$' | head -1)
  [ -n "$PORT" ] && break
  sleep 2
done
echo "PORT=$PORT"
if [ -n "$PORT" ]; then
  curl -s --max-time 10 "http://127.0.0.1:$PORT/" > .smoke/index.html
  echo "=== script tags ==="
  grep -oE '<script[^>]*>' .smoke/index.html | head -15
  echo "=== external src refs ==="
  grep -oE 'src="[^"]+"' .smoke/index.html | sort -u | head -15
fi
kill $PID 2>/dev/null
echo DONE
