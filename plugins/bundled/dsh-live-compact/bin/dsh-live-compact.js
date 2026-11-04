#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"));
const arg = process.argv[2];
if (arg === "--version" || arg === "-v") {
  console.log(pkg.version);
  process.exit(0);
}
console.log(`${pkg.name} ${pkg.version}`);
console.log("dsh plugin --profile web add https://download.merkyorlynn.com/downloads/plugins/dsh-live-compact-1.0.1.tgz");
