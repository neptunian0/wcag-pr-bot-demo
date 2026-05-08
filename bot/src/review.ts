/**
 * Bot entrypoint. Designed to run inside a GitHub Action triggered by
 * `pull_request` events. Reads the PR diff via the GitHub API, sends each
 * file's patch to Claude for WCAG review, and posts the findings back as a
 * single PR review with inline comments. Each comment ends with a hidden
 * fingerprint comment used by the post-merge disposition classifier.
 *
 * Required env:
 *   GITHUB_REPOSITORY  - "owner/name"
 *   GITHUB_TOKEN       - token with pull-requests:write
 *   PR_NUMBER          - the PR to review (or GITHUB_PR_NUMBER)
 *   ANTHROPIC_API_KEY  - or ANTHROPIC_AUTH_TOKEN
 *
 * Optional env:
 *   ANTHROPIC_BASE_URL - if routing through a proxy
 *   WCAG_BOT_MODEL     - override the review model
 */

import { loadEnv } from "./load-env.js";
loadEnv();

import { Octokit } from "@octokit/rest";
import Anthropic from "@anthropic-ai/sdk";
import { reviewDiff } from "./prompt.js";
import type { Finding } from "./types.js";

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} is required`);
  return v;
}

const repository = requireEnv("GITHUB_REPOSITORY");
const ghToken = requireEnv("GITHUB_TOKEN");
const prNumberStr = (process.env.PR_NUMBER ?? process.env.GITHUB_PR_NUMBER ?? "").trim();
if (!prNumberStr) throw new Error("PR_NUMBER (or GITHUB_PR_NUMBER) is required");

const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
const authToken = process.env.ANTHROPIC_AUTH_TOKEN?.trim();
if (!apiKey && !authToken) {
  throw new Error("ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN is required");
}

const [owner, repo] = repository.split("/");
const pull_number = Number(prNumberStr);
if (!Number.isInteger(pull_number) || pull_number <= 0) {
  throw new Error(`PR_NUMBER must be a positive integer, got ${prNumberStr}`);
}

const octokit = new Octokit({ auth: ghToken });
const anthropic = new Anthropic({
  apiKey: apiKey || undefined,
  authToken: authToken || undefined,
  baseURL: process.env.ANTHROPIC_BASE_URL || undefined
});

const REVIEWABLE = /\.(html|ts|scss|css)$/;
const SKIP_PATHS = /(^|\/)(node_modules|dist|\.angular)\//;

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
  const { data: files } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number,
    per_page: 100
  });

  const reviewable = files.filter(
    (f) =>
      REVIEWABLE.test(f.filename) &&
      !SKIP_PATHS.test(f.filename) &&
      f.status !== "removed" &&
      typeof f.patch === "string"
  );

  if (reviewable.length === 0) {
    console.log("No reviewable files in this PR. Exiting.");
    return;
  }

  console.log(`Reviewing ${reviewable.length} file(s):`);
  for (const f of reviewable) {
    console.log(`  - ${f.filename} (+${f.additions}/-${f.deletions})`);
  }

  const diffs = reviewable.map((f) => ({ path: f.filename, patch: f.patch! }));
  const findings = await reviewDiff(anthropic, diffs, { verbose: true });
  console.log(`\nClaude returned ${findings.length} finding(s).`);

  if (findings.length === 0) {
    console.log("Clean run. Posting empty approving review for visibility.");
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      event: "COMMENT",
      body: "WCAG review: no introduced accessibility issues found in this PR's diff."
    });
    return;
  }

  const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number });
  const commit_id = pr.head.sha;

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

  try {
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      commit_id,
      event,
      body: summary,
      comments
    });
    console.log(`Posted review (event=${event}) with ${comments.length} inline comment(s).`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to post review: ${msg}`);
    console.error(
      "Inline comments may have failed because Claude pointed at a line not in the diff. " +
        "Falling back to posting the summary as a top-level review without inline anchoring."
    );
    await octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      commit_id,
      event: "COMMENT",
      body: [
        summary,
        "",
        "Inline anchoring failed; findings listed below:",
        "",
        ...findings.map(
          (f) =>
            `- **[${f.severity}] ${f.file}:${f.line}** WCAG ${f.wcag_sc} — ${f.title}\n  ${f.message}`
        )
      ].join("\n")
    });
    process.exitCode = 1;
    return;
  }

  if (blockers.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
