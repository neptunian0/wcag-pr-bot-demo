/**
 * Disposition classifier. For each closed PR passed on the command line,
 * find the bot's review comments (identified by the WCAG_BOT::{...}
 * fingerprint), pull each thread plus the file's final state at the merge
 * commit, and ask Claude Opus to classify the disposition.
 *
 * Output is merged into bot/data/dispositions.json — keyed by (pr, commentId).
 *
 * Usage:
 *   npm run classify -- 1 2 3 4
 */

import { loadEnv } from "./load-env.js";
loadEnv();

import { Octokit } from "@octokit/rest";
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { classifyDisposition } from "./disposition-prompt.js";
import type { ClassifyResult } from "./disposition-prompt.js";

const prNumbers = process.argv
  .slice(2)
  .map((s) => Number(s))
  .filter((n) => Number.isInteger(n) && n > 0);
if (prNumbers.length === 0) {
  console.error("Usage: npm run classify -- <pr1> [pr2] ...");
  process.exit(1);
}

const repository = process.env.GITHUB_REPOSITORY?.trim();
const ghToken = process.env.GITHUB_TOKEN?.trim();
if (!repository) throw new Error("GITHUB_REPOSITORY env required (format: owner/name)");
if (!ghToken) throw new Error("GITHUB_TOKEN env required (PAT with repo read scope)");

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
if (!apiKey && !authToken) {
  throw new Error("ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required");
}

const [owner, repo] = repository.split("/");
const octokit = new Octokit({ auth: ghToken });
const anthropic = new Anthropic({
  apiKey: apiKey || undefined,
  authToken: authToken || undefined,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined
});

const FINGERPRINT_RE = /<!--\s*WCAG_BOT::(.+?)\s*-->/;

interface DispositionRecord extends ClassifyResult {
  pr: number;
  commentId: number;
  file: string;
  line: number;
  finding: { sc: string; severity: string; confidence: string; title: string };
  classifiedAt: string;
}

async function main() {
  const newRecords: DispositionRecord[] = [];

  for (const pr of prNumbers) {
    console.log(`\n=== PR #${pr} ===`);

    const { data: prData } = await octokit.rest.pulls.get({ owner, repo, pull_number: pr });
    if (prData.state !== "closed") {
      console.log(`  Skipping: PR is ${prData.state}, not closed.`);
      continue;
    }

    const comments = await octokit.paginate(octokit.rest.pulls.listReviewComments, {
      owner,
      repo,
      pull_number: pr,
      per_page: 100
    });

    const botComments = comments.filter((c) => FINGERPRINT_RE.test(c.body ?? ""));
    if (botComments.length === 0) {
      console.log(`  No bot fingerprints found.`);
      continue;
    }
    console.log(`  Found ${botComments.length} bot finding(s).`);

    const finalSha = prData.merge_commit_sha ?? prData.head.sha;
    const fileCache = new Map<string, string>();

    async function getFinalContent(path: string): Promise<string> {
      if (fileCache.has(path)) return fileCache.get(path)!;
      try {
        const { data } = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: finalSha
        });
        if (!Array.isArray(data) && "content" in data && typeof data.content === "string") {
          const decoded = Buffer.from(data.content, "base64").toString("utf8");
          fileCache.set(path, decoded);
          return decoded;
        }
      } catch (err) {
        console.warn(`    fetch ${path}@${finalSha.slice(0, 7)} failed: ${(err as Error).message}`);
      }
      fileCache.set(path, "");
      return "";
    }

    for (const c of botComments) {
      const m = (c.body ?? "").match(FINGERPRINT_RE);
      if (!m) continue;

      let finding: DispositionRecord["finding"];
      try {
        finding = JSON.parse(m[1]);
      } catch {
        console.log(`    Skipping comment ${c.id}: malformed fingerprint.`);
        continue;
      }

      const replies = comments.filter((other) => other.in_reply_to_id === c.id);
      const thread = [c, ...replies].map((r) => ({
        author: r.user?.login ?? "unknown",
        body: r.body ?? "",
        created_at: r.created_at
      }));

      const finalContent = await getFinalContent(c.path);

      const result = await classifyDisposition(anthropic, {
        finding,
        thread,
        filePath: c.path,
        finalContent,
        prMerged: prData.merged_at != null
      });

      console.log(
        `    ${c.path}:${c.line ?? "?"}  ${finding.sc}  →  ${result.disposition} (${result.classifierConfidence})`
      );

      newRecords.push({
        pr,
        commentId: c.id,
        file: c.path,
        line: c.line ?? 0,
        finding,
        ...result,
        classifiedAt: new Date().toISOString()
      });
    }
  }

  const outPath = resolve(import.meta.dirname, "..", "data", "dispositions.json");
  const existing: { dispositions: DispositionRecord[] } = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, "utf8"))
    : { dispositions: [] };

  const byKey = new Map<string, DispositionRecord>();
  for (const d of existing.dispositions) byKey.set(`${d.pr}:${d.commentId}`, d);
  for (const d of newRecords) byKey.set(`${d.pr}:${d.commentId}`, d);

  const merged = {
    lastRun: new Date().toISOString(),
    dispositions: [...byKey.values()].sort((a, b) =>
      a.pr === b.pr ? a.commentId - b.commentId : a.pr - b.pr
    )
  };

  writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");
  console.log(
    `\nWrote ${outPath}. ${newRecords.length} new, ${merged.dispositions.length} total.`
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
