// Probe node-pty (persistent terminal path) for visible console windows.
const pty = require("d:/PycharmProjects/Work/dsh-vscode/vendor/node_modules/node-pty");
const { execSync } = require("child_process");
const proc = pty.spawn("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 4"],
  { name: "dumb", cols: 80, rows: 24, cwd: "D:\\PycharmProjects\\Work\\VisionLeeQT", env: process.env });
const t0 = Date.now();
const poll = setInterval(() => {
  if (Date.now() - t0 > 6000) { clearInterval(poll); return; }
  try {
    const r = execSync('powershell -NoProfile -Command "Get-Process powershell,conhost -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object Id,ProcessName | ConvertTo-Json -Compress"', { windowsHide: true });
    const s = r.toString().trim();
    if (s) console.log(`[t+${Date.now() - t0}ms] VISIBLE WINDOW: ${s}`);
  } catch {}
}, 700);
proc.onExit(() => {
  clearInterval(poll);
  console.log("pty exit");
});
