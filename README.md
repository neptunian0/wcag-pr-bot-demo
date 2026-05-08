# WCAG PR Review Bot — Hackathon Demo

A Claude-powered GitHub bot that reviews pull requests for WCAG 2.2 AA accessibility compliance. Built as a hackathon prototype for Validis's Angular + PrimeNG codebase.

## What this is

Manual accessibility checks decay; engineering teams accumulate a11y debt without realising. This bot puts a soft enforcement step at PR time:

- **Mechanical issues** with near-zero false-positive risk (missing `alt`, unlabelled inputs, icon-only buttons with no name) are **blocking**. The PR review is posted as `REQUEST_CHANGES`.
- **Judgment calls** (heading hierarchy, "click here" link text, contrast issues in remediation) are **non-blocking** — engineers can resolve, dismiss-with-reason, or fix.
- A separate **disposition classifier** (Claude Opus) reviews each thread post-merge and labels how the comment was handled: `fixed` / `legitimately_dismissed` / `weak_dismissal` / `unaddressed`.
- A static **dashboard** rolls up the data for leadership: introduced vs resolved per week, top dismissed criteria, open weak dismissals.

## Repo tour

```
src/                                      Angular 19 + PrimeNG mock app — three screens
  app/login/login.component.html          ↳ form labelling, link text, button semantics
  app/engagements/engagements.component.html ↳ data table; status indicators, contrast
  app/settings/settings.component.html    ↳ heading structure, focus management, error association

bot/
  src/prompt.ts                           WCAG review system prompt + tool schema
  src/review.ts                           bot entrypoint; called by GitHub Actions
  src/test-prompt.ts                      hand-test against a synthetic diff
  src/disposition-prompt.ts               post-merge classifier prompt (Opus)
  src/classify.ts                         classifier entrypoint
  src/dashboard.ts                        static dashboard generator
  data/aggregate.json                     mocked aggregate driving the demo dashboard
  dashboard.html                          generated leadership view (committed for demo)

.github/workflows/wcag-review.yml         CI workflow; pull_request trigger

SEEDED_ISSUES.md                          ground-truth catalog of every planted issue
DEMO_PLAN.md                              4-PR demo storyline
```

## Architecture

1. PR opens → GitHub Action triggers
2. `bot/src/review.ts` reads the PR diff via the GitHub API and sends each file's patch to Claude with a structured WCAG review prompt
3. Claude returns findings via tool use (forced JSON shape)
4. Bot posts a single PR review with inline comments. Each comment ends with a hidden fingerprint:
   ```html
   <!-- WCAG_BOT::{"sc":"1.1.1","severity":"blocking","confidence":"high","title":"img missing alt"} -->
   ```
5. After PRs close, `bot/src/classify.ts` finds the fingerprints, pulls each thread + final file state, and asks Claude Opus for disposition
6. `bot/src/dashboard.ts` reads the aggregated data and emits `bot/dashboard.html`

## Ratchet semantics

The bot only flags issues on `+` (added) lines in the diff. Pre-existing issues that show up in context are not re-flagged — that means engineers can refactor without being held hostage by historical debt.

## Running the mock app

```bash
ng serve
# open http://localhost:4200
```

Three routes: `/login`, `/engagements`, `/settings`.

## Running the bot

The bot needs an Anthropic API key in `bot/.env`:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > bot/.env

cd bot
npm install
npm run test-prompt    # hand-test against a synthetic diff from login.component.html
npm run dashboard      # regenerate dashboard.html from data/aggregate.json
```

`npm run review` posts findings to a real PR; it expects `GITHUB_REPOSITORY`, `GITHUB_TOKEN`, and `PR_NUMBER` envs (set automatically by the GitHub Action).

`npm run classify -- 1 2 3 4` runs the disposition classifier on the listed closed PRs and writes results to `bot/data/dispositions.json`.

## The 4-PR demo

Four feature branches stage the demo storyline (see [`DEMO_PLAN.md`](DEMO_PLAN.md)):

| Branch | What it does | Expected bot output |
|---|---|---|
| `demo/pr1-add-logo` | Adds hero banner + 2 icon buttons + sign-up link | 3 blocking + 1 non-blocking |
| `demo/pr2-refactor-table` | Pure refactor (extract type, add count badge) | clean run |
| `demo/pr3-revert-disabled-styling` | Reverts a previously-fixed contrast issue | 1 non-blocking (1.4.11 regression) |
| `demo/pr4-email-notifications` | New settings panel; missing required indicator + unlinked error | 1 blocking + 1 non-blocking |

## Validis WCAG policy embedded in the prompt

The system prompt at [`bot/src/prompt.ts`](bot/src/prompt.ts) encodes the team's compliance decisions:

- WCAG 2.2 AA target, with selective AAA for focus indicators (2.4.7), target sizes (2.5.5), contextual help (3.3.5), section headings (2.4.10), and error prevention (3.3.4)
- 1.3.4 Orientation is N/A — desktop-only product
- 2.4.5 Multiple Ways satisfied at the application level via global nav + search
- 1.4.11 Non-text Contrast in active remediation; bot flags as non-blocking until lifted
- PrimeNG `<p-button label="...">` exposes accessible name from the label property; not flagged
- Belief-based exemptions (2.1.1 accesskey, 2.1.4 printable shortcuts, 2.2.2 auto-update, 2.3.3 animation, 3.3.8 cognitive function tests in auth) are not flagged unless directly observed

## Status

Built as a hackathon prototype. Production target is ADO + Azure Pipelines; the GitHub Actions workflow is the equivalent for the demo.
