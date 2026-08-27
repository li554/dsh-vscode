const { fork } = require("node:child_process");
const c = fork(require("node:path").join(__dirname, "child.cjs"), [], {
  execArgv: ["--expose-internals"],
  env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
  stdio: ["ignore", "pipe", "pipe", "ipc"]
});
c.stdout.on("data", (d) => process.stdout.write("[child] " + d));
c.stderr.on("data", (d) => process.stdout.write("[child-err] " + d));
c.on("exit", (code) => { console.log("[parent] child exit", code); process.exit(0); });
setTimeout(() => { console.log("[parent] timeout"); process.exit(1); }, 20000);
