// Every client-side command contribution must pass `description` as a FUNCTION.
//
// The 0.1.5 client builds the '/' menu with
//
//     rows.push({ name: contribution.name, description: contribution.description() })
//
// so it CALLS the field. A contribution written against the older client, where a
// plain string was accepted, throws
//
//     TypeError: contribution.description is not a function
//
// inside the candidate builder — and because that builder is one function, the
// ENTIRE command source fails. The symptom is not "one command is missing": '/'
// lists skills and no commands at all, so /goal, /compact, /feedback, /model …
// all disappear together.
//
// That is exactly what @canglongcl/dsh-web-review did (description: t("…")), so this
// test guards the shape across every bundled client half. It reads the shipped
// files, not a fixture, so a plugin added to plugins/bundled is covered on arrival.
//
// Usage: node .smoke/client-command-shape.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const BUNDLED = path.join(ROOT, "plugins", "bundled");

let failures = 0;
const check = (label, ok, detail = "") => {
  if (ok) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? "  " + detail : ""}`);
};

const files = [];
(function walk(dir, depth) {
  if (depth > 7) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "types") walk(full, depth + 1); }
    else if (/\.(js|mjs|cjs)$/.test(e.name)) files.push(full);
  }
})(BUNDLED, 0);

/** The text of the object literal passed to a call, brace-matched. */
function objectLiteral(text, from) {
  const open = text.indexOf("{", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(open, i + 1); }
  }
  return text.slice(open, open + 2000);
}

/** Strip line and block comments, so an explanatory `description: …` inside prose
 *  (like the one this very patch adds) is not mistaken for a registration. */
function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const registrations = [];
let clientFiles = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  // Client halves only: host-side commands register with a STRING description on
  // purpose (the client is what turns it into a thunk). A DSH web client bundle
  // always announces itself through the module loader.
  if (!raw.includes("__ModuleLoader__")) continue;
  clientFiles++;
  const text = stripComments(raw);
  const re = /(?:commandUi|commands?|command)\.register\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    const literal = objectLiteral(text, m.index);
    const nameMatch = /name\s*:\s*["'`]([^"'`]+)["'`]/.exec(literal);
    const descMatch = /description\s*:\s*([^,\n}]+)/.exec(literal);
    registrations.push({
      file: path.relative(ROOT, file),
      name: nameMatch ? nameMatch[1] : "(anonymous)",
      // Absent is fine; a thunk or a function expression is fine.
      raw: descMatch ? descMatch[1].trim() : null
    });
  }
}

console.log(`scanned ${files.length} bundled files (${clientFiles} client bundles), found ${registrations.length} client command registration(s)\n`);
for (const r of registrations) {
  const ok = r.raw === null || /^\(\s*\)\s*=>/.test(r.raw) || /^\(?[\w,\s]*\)?\s*=>/.test(r.raw) || /^function\b/.test(r.raw);
  check(`${r.name} in ${path.basename(r.file)} has a function description`, ok, `description: ${r.raw}`);
}

// The specific regression, stated directly so a revert names itself.
const webReview = fs.readFileSync(path.join(BUNDLED, "@canglongcl", "dsh-web-review", "lib", "client-official.js"), "utf8");
check("web-review /skills contribution is thunked", /description:\s*\(\)\s*=>\s*t\("command\.skills\.description"\)/.test(webReview));
check("web-review no longer passes a bare translated string", !/description:\s*t\("command\.skills\.description"\)/.test(webReview));

console.log(`\nRESULT: ${failures === 0 ? "PASS" : `FAIL (${failures} check(s))`}`);
process.exit(failures === 0 ? 0 : 1);
