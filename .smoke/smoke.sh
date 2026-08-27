#!/bin/bash
set -u
cd "D:/PycharmProjects/Work/dsh-vscode"
DSH_HOME="D:/PycharmProjects/Work/dsh-vscode/.smoke/home" node node_modules/@deepseek-ai/dsh/lib/bin.js --profile web --port 0 --no-open   > .smoke/host.log 2>&1 &
PID=$!
echo "host pid $PID"
PORT=""
for i in $(seq 1 60); do
  if ! kill -0 $PID 2>/dev/null; then echo "HOST DIED"; tail -30 .smoke/host.log; exit 1; fi
  PORT=$(grep -oE 'dsh web: http://127.0.0.1:[0-9]+' .smoke/host.log | grep -oE '[0-9]+$' | head -1)
  [ -n "$PORT" ] && break
  sleep 2
done
echo "PORT=$PORT"
if [ -z "$PORT" ]; then echo "NO URL LINE"; tail -30 .smoke/host.log; kill $PID; exit 1; fi
echo "=== root (first 400 bytes) ==="
curl -s --max-time 10 "http://127.0.0.1:$PORT/" | head -c 400; echo
echo "=== boot injection present? ==="
curl -s --max-time 10 "http://127.0.0.1:$PORT/" | grep -c "DSH_BOOT"
echo "=== /plugins client.js routes (sample) ==="
curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1:$PORT/plugins/connection/client.js"; echo " <- connection client.js"
curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://127.0.0.1:$PORT/plugins/ui-theme/client.js"; echo " <- ui-theme client.js"
echo "=== fence: browser-marked cross-site request (expect 403) ==="
curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST   -H "Content-Type: application/json" -H "Origin: http://evil.example" -H "Sec-Fetch-Site: cross-site"   --data '{}' "http://127.0.0.1:$PORT/api/session.list"; echo " <- with Origin+sec-fetch"
echo "=== fence: clean extension-host-like request (expect NOT 403) ==="
curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X POST   -H "Content-Type: application/json" --data '{"rpcId":"smoke-1","method":"session.list","payload":{}}'   "http://127.0.0.1:$PORT/api/session.list"; echo " <- no browser markers"
kill $PID 2>/dev/null
echo SMOKE-DONE
