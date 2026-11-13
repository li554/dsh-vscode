#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readCutStats } from "../shadow.js";

const pkg = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../package.json"), "utf8"));
const arg = process.argv[2];
if (arg === "stats") {
  const dir = process.env.SPINE_SHADOW_DIR || join(process.env.DSH_HOME || join(homedir(), ".dsh"), "compaction-spine", "shadow");
  const stats = readCutStats(dir);
  const usd = (stats.savedTokens * 0.15) / 1e6;
  console.log(`cuts ${stats.cuts}`);
  console.log(`saved ${stats.savedTokens}`);
  console.log(`rewrite ${stats.rewriteTokens}`);
  console.log(`估算 $${usd.toFixed(2)}，saved × $0.15/M，未扣除重写未命中成本`);
  process.exit(0);
}
if (arg === "--version" || arg === "-v") {
  console.log(pkg.version);
  process.exit(0);
}
console.log(`${pkg.name} ${pkg.version}`);
console.log(`dsh plugin --profile headless add https://download.merkyorlynn.com/downloads/plugins/dsh-live-compact-${pkg.version}.tgz`);
console.log(`dsh plugin --profile web add https://download.merkyorlynn.com/downloads/plugins/dsh-live-compact-${pkg.version}.tgz`);
