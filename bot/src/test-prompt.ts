/**
 * Hand-test the WCAG review prompt against a synthetic diff built from a
 * seeded component. The component's <!-- A11Y-ISSUE: ... --> annotations are
 * stripped before the diff is sent, so the bot only sees what an engineer
 * would see.
 *
 * Usage:
 *   npm run test-prompt                                 # defaults to login
 *   npm run test-prompt -- src/app/engagements/...html  # specific file
 */

import { loadEnv } from "./load-env.js";
loadEnv();

import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reviewDiff } from "./prompt.js";

const repoRoot = resolve(import.meta.dirname, "..", "..");

const target = process.argv[2] ?? "src/app/login/login.component.html";
const fullPath = resolve(repoRoot, target);

const raw = readFileSync(fullPath, "utf8");
const stripped = raw
  .replace(/<!-- A11Y-ISSUE:[\s\S]*?-->/g, "")
  .replace(/^\s*\/\/ A11Y-ISSUE:.*$/gm, "");

const lines = stripped.split("\n");
const patch = [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((l) => `+${l}`)].join("\n");

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
if (!apiKey && !authToken) {
  console.error(
    "ERROR: No Anthropic credentials in env. Set ANTHROPIC_API_KEY (or ANTHROPIC_AUTH_TOKEN) " +
      "either in your shell, or in bot/.env (loaded via `tsx --env-file=.env`)."
  );
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: apiKey || undefined,
  authToken: authToken || undefined,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined
});

console.log(`Reviewing ${target} (${lines.length} lines after strip)\n`);
const findings = await reviewDiff(anthropic, [{ path: target, patch }], { verbose: true });

console.log(`\n=== ${findings.length} finding(s) ===\n`);
for (const f of findings) {
  console.log(`[${f.severity}/${f.confidence}] ${f.file}:${f.line}  WCAG ${f.wcag_sc}`);
  console.log(`  ${f.title}`);
  console.log(`  ${f.message}`);
  console.log(`  > ${f.code_snippet.trim()}\n`);
}
