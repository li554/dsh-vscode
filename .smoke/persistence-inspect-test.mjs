// The bundled @dsh-undo/* plugins call `ctx.sessionPersistence.inspect(id)`, which
// the 0.1.5-rc.2 jsonl backend does not provide — so the Archive Tasks surface
// failed with `sessionPersistence.inspect is not a function` for every archived
// (non-live) session, while live sessions never reached it because callers prefer
// `ctx.sessions.get(id)?.events` and only fall back to persistence.
//
// This asserts the local `inspect(id)` patch is really ON THE PROTOTYPE — a real
// property of the loaded module, not a substring of its source — so a vendored
// refresh that drops the patch fails here instead of in the field.
//
// Usage: node .smoke/persistence-inspect-test.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const FILE = path.join(ROOT, "vendor", "node_modules", "@deepseek-ai", "dsh-session-persistence-jsonl", "lib", "index.js");

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};

check("the backend module exists", fs.existsSync(FILE), FILE);
if (fs.existsSync(FILE)) {
  const mod = await import(pathToFileURL(FILE).href);
  const Ctor = mod.default ?? Object.values(mod).find((v) => typeof v === "function" && v.prototype);
  check("the service class loads", typeof Ctor === "function");
  check("inspect is defined on the prototype", typeof Ctor?.prototype?.inspect === "function");
  check("it takes (id, options)", Ctor?.prototype?.inspect?.length === 2, `arity ${Ctor?.prototype?.inspect?.length}`);
  // The methods the patch builds on must still be there, or `inspect` is dead code
  // even though it is defined.
  check("open() is still available", typeof Ctor?.prototype?.open === "function");
  check("list() is still available", typeof Ctor?.prototype?.list === "function");
  check("locate() is still available", typeof Ctor?.prototype?.locate === "function");
}

console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
process.exit(failures === 0 ? 0 : 1);
