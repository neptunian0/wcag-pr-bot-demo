/**
 * Replay pre-generated findings to a real GitHub PR. Used for the demo
 * when live API access isn't available — the findings are produced
 * ahead of time by Claude (interactively) and saved as JSON, then this
 * script posts them via the GitHub API as a single PR review.
 *
 * Usage:
 *   npm run replay -- --pr 1 --json data/findings/pr1.json
 *
 * Required env:
 *   GITHUB_REPOSITORY  - "owner/name"
 *   GITHUB_TOKEN       - PAT with pull-requests:write (or repo scope)
 */

import { loadEnv } from "./load-env.js";
loadEnv();

import { Octokit } from "@octokit/rest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Finding } from "./types.js";

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i === -1 || i === process.argv.length - 1) return undefined;
  return process.argv[i + 1];
}

const prStr = getFlag("--pr");
const jsonPath = getFlag("--json");
if (!prStr || !jsonPath) {
  console.error("Usage: npm run replay -- --pr <number> --json <path>");
  process.exit(1);
}

const repository = process.env.GITHUB_REPOSITORY?.trim();
const ghToken = process.env.GITHUB_TOKEN?.trim();
if (!repository) throw new Error("GITHUB_REPOSITORY env required (format: owner/name)");
if (!ghToken) throw new Error("GITHUB_TOKEN env required");

const [owner, repo] = repository.split("/");
const pull_number = Number(prStr);
if (!Number.isInteger(pull_number) || pull_number <= 0) {
  throw new Error(`--pr must be a positive integer, got ${prStr}`);
}

const octokit = new Octokit({ auth: ghToken });

const fullJsonPath = resolve(process.cwd(), jsonPath);
const parsed: { findings: Finding[] } = JSON.parse(readFileSync(fullJsonPath, "utf8"));
const findings = parsed.findings;

function buildCommentBody(f: Finding): string {
  const fingerprint = `<!-- WCAG_BOT::${JSON.stringify({
    sc: f.wcag_sc,
    severity: f.severity,
    confidence: f.confidence,
    title: f.title
  })} -->`;
  const tier = f.severity === "blocking" ? "BLOCKING" : "Non-blocking";
  return [
    `**[${tier}] WCAG ${f.wcag_sc}: ${f.title}**`,
    "",
    f.message,
    "",
    "```html",
    f.code_snippet,
    "```",
    "",
    `_Confidence: ${f.confidence}_`,
    "",
    fingerprint
  ].join("\n");
}

async function main() {
  console.log(`Replaying ${findings.length} finding(s) onto ${owner}/${repo} PR #${pull_number}`);

  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number });
  const commit_id = pr.head.sha;

  if (findings.length === 0) {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      event: "COMMENT",
      body: "WCAG review: no introduced accessibility issues found in this PR's diff."
    });
    console.log("Posted COMMENT review (clean run).");
    return;
  }

  const blockers = findings.filter((f) => f.severity === "blocking");
  const nonBlockers = findings.length - blockers.length;
  const event = blockers.length > 0 ? "REQUEST_CHANGES" : "COMMENT";

  const summary =
    blockers.length > 0
      ? `Found **${blockers.length} blocking** and **${nonBlockers} non-blocking** WCAG issue(s) introduced by this PR. Blocking issues should be addressed before merge; non-blocking issues are judgment calls — fix or dismiss with reasoning.`
      : `Found **${nonBlockers} non-blocking** WCAG issue(s) introduced by this PR. These are judgment calls — fix or dismiss with reasoning.`;

  const comments = findings.map((f) => ({
    path: f.file,
    line: f.line,
    side: "RIGHT" as const,
    body: buildCommentBody(f)
  }));

  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number,
    commit_id,
    event,
    body: summary,
    comments
  });

  console.log(`Posted ${event} review with ${comments.length} inline comment(s).`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
