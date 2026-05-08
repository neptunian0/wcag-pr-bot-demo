# Hackathon Demo Plan

Sequence of staged PRs to walk through during the demo. Each one demonstrates a different aspect of the bot's value proposition.

## Setup before the demo

1. Repo is on `main` with all seeded issues already in place (the baseline).
2. Bot has already run on `main` and produced a "current state" report — your starting point. This is the *ratchet baseline*: nothing here blocks.
3. Stage the four feature branches below as draft PRs *before* the demo. Open them live during the walkthrough.

---

## PR 1 — "Add company logo to login screen"

**The setup:** A small, plausible feature change. Adds a hero banner with a logo, two new icon buttons in the header, and tweaks login form copy.

**Issues introduced:**
- Hero banner image missing `alt` (Blocking) — bot flags
- New header icon buttons missing `aria-label` (Blocking, ×2) — bot flags
- Copy tweak introduces "Click here for help" link (Non-blocking) — bot flags as a judgment call

**Engineer's responses to demo:**
- Pushes a fix for the alt text
- Adds aria-labels to the icon buttons
- Dismisses the "Click here" flag with a reason: *"Surrounding text provides context — see WCAG 2.4.4 In Context exception."*

**What this demonstrates:** The blocking/non-blocking tier system. Engineer can ship without addressing the judgment call but must engage with it.

---

## PR 2 — "Refactor engagements table"

**The setup:** A pure refactor — should introduce zero accessibility issues.

**Issues introduced:** None.

**Bot output:** Clean run. No new findings. Existing issues on `main` are still present in the diff's blast radius but are *not* re-flagged because they're pre-existing.

**What this demonstrates:** The ratchet semantics. The bot doesn't yell about pre-existing debt on every PR — only regressions get blocked. Engineers can refactor without being held hostage by historical issues.

---

## PR 3 — "Quick fix: revert button styling"

**The setup:** An engineer "fixes" the disabled button styling by reverting to the old low-opacity version. This is a regression of E4 from `SEEDED_ISSUES.md`, which had been partially addressed on `main`.

**Issues introduced:**
- Disabled button contrast regression (Blocking when reintroduced) — bot flags as a regression

**What this demonstrates:** The ratchet catches regressions. An issue that was already on the team's radar (linked to a Jira ticket via the bot's metadata) is re-flagged with extra context — *"this issue was previously resolved in commit X; this PR reintroduces it."*

---

## PR 4 — "Add email notification preferences"

**The setup:** A new settings panel. Engineer is in a hurry and dismisses a real issue with weak reasoning.

**Issues introduced:**
- Required email field missing required indicator (Non-blocking) — bot flags
- Error message not associated with input via aria-describedby (Blocking) — bot flags

**Engineer's responses:**
- Fixes the aria-describedby (the blocker)
- Dismisses the required-field flag with: *"Will fix in next PR"*

**What this demonstrates:** The disposition classifier. After the PR merges, the aggregation script reviews the dismissal, classifies it as *"weak dismissal — no concrete plan, no follow-up ticket"*, and flags it on the dashboard for visibility.

---

## The wrap-up artifact

After walking through the four PRs, run the aggregation script and show the resulting report:

- Issues introduced this week: **6**
- Issues resolved this week: **5**
- Open weak dismissals: **1** (PR 4 — required field indicator)
- Top dismissed criteria: 2.4.4 (link purpose) — recurring pattern, candidate for prompt tuning
- Trend: net-positive (more resolved than introduced)

This is the "leadership view" — the artifact that turns a per-PR check into an organisational signal. It's also the part that makes the case for upgrading from hackathon prototype to production tool.

---

## Pacing

Aim for 8 minutes:

- 1 min framing — the problem (existing WCAG doc, no enforcement, manual checks decay)
- 5 min walkthrough — PR 1 → 4
- 2 min wrap-up artifact + future vision (where this goes next: ADO integration, broader rule coverage, design-time variant)
