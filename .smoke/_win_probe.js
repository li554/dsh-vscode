// Mimic the extension host spawning the ACL sandbox runner (windowsHide: true),
// then poll for any visible console window owned by pwsh/conhost/cmd.
const { spawn } = require("child_process");
const runner = "d:/PycharmProjects/Work/dsh-vscode/vendor/node_modules/@deepseek-ai/dsh-sandbox-windows-acl/lib/runner.js";
const child = spawn(process.execPath, [
  runner,
  "--workspace", "D:\\PycharmProjects\\Work\\VisionLeeQT",
  "--temp", "C:\\Users\\li554\\AppData\\Local\\Temp",
  "--mode", "read-only",
  "--", "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command", "Write-Output 'hello-sandbox'; Start-Sleep -Seconds 3; Write-Error 'stderr-check'"
], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let out = "";
child.stdout.on("data", (d) => out += d);
child.stderr.on("data", (d) => out += d);
const t0 = Date.now();
const poll = setInterval(() => {
  if (Date.now() - t0 > 6000 || child.exitCode !== null) { clearInterval(poll); return; }
  const { execSync } = require("child_process");
  try {
    const r = execSync('powershell -NoProfile -Command "Get-Process pwsh,conhost,node -ErrorAction SilentlyContinue | Where-Object {$_.MainWindowHandle -ne 0} | Select-Object Id,ProcessName,MainWindowTitle | ConvertTo-Json -Compress"', { windowsHide: true });
    const s = r.toString().trim();
    if (s) console.log(`[t+${Date.now() - t0}ms] VISIBLE WINDOW: ${s}`);
  } catch {}
}, 700);
child.on("exit", (code) => {
  clearInterval(poll);
  console.log("runner exit:", code, "out:", out.slice(0, 400));
});
