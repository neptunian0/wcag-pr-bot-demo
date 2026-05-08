# Seeded Accessibility Issues

Ground-truth catalog of every issue planted in the mock app, mapped to the WCAG 2.2 success criterion it violates. Used to evaluate the bot's recall and precision.

Severity assignments follow the policy from the team's WCAG compliance document: high-confidence mechanical violations are **blocking**, judgment calls are **non-blocking**, items the bot might flag but shouldn't are listed as **false-positive bait**.

## `login.component.html`

| # | Issue | WCAG SC | Severity | Notes |
|---|-------|---------|----------|-------|
| L1 | `<img>` with no `alt` attribute | 1.1.1 | Blocking | Logo image, decorative or informative is itself a judgment call — but missing alt is mechanical |
| L2 | Heading hierarchy starts at `<h2>` | 1.3.1, 2.4.10 | Non-blocking | No `<h1>` on the page |
| L3 | Email input labelled by placeholder only | 1.3.1, 3.3.2, 4.1.2 | Blocking | Placeholder disappears when user types |
| L4 | Password input labelled by placeholder only | 1.3.1, 3.3.2, 4.1.2 | Blocking | Same pattern |
| L5 | `<div>` with `(click)` used instead of `<button>` | 4.1.2, 2.1.1 | Blocking | Not keyboard-focusable, no role |
| L6 | Link text "Click here" is non-descriptive | 2.4.4 | Non-blocking | Surrounding text gives some context — judgment call |

**Correct patterns to verify the bot doesn't false-positive:**
- The "Remember me" checkbox is properly associated with its `<label for="rememberMe">`

---

## `engagements.component.html`

| # | Issue | WCAG SC | Severity | Notes |
|---|-------|---------|----------|-------|
| E1 | Status conveyed by background colour only | 1.4.1 | Blocking | Coloured dot with no text/icon |
| E2 | Edit icon button missing `aria-label` | 4.1.2 | Blocking | Mechanical — `pi-pencil` icon only |
| E3 | Delete icon button missing `aria-label` | 4.1.2 | Blocking | Same pattern |
| E4 | Disabled "Generate Report" button uses 0.4 opacity, fails 1.4.11 | 1.4.11 | Non-blocking | Exactly the case discussed in the WCAG doc — needs the planned remediation |
| E5 | Sortable column headers have no `aria-sort` attribute | 1.3.1 | Non-blocking | PrimeNG should handle this — check if it actually does |

**Correct patterns:**
- Action buttons in the page header have visible text labels

**False-positive bait:**
- The status colour also has a `title` attribute — bot might miss this and flag it as colour-only. Strictly, `title` isn't sufficient (not exposed to all assistive tech), so the flag would actually be correct, but document the bot's reasoning.

---

## `settings.component.html`

| # | Issue | WCAG SC | Severity | Notes |
|---|-------|---------|----------|-------|
| S1 | `<h1>` followed directly by `<h3>` | 1.3.1 | Non-blocking | Skips heading level |
| S2 | Modal close `×` button has no accessible name | 4.1.2 | Blocking | Icon-only with no aria-label |
| S3 | Required email field not marked with `aria-required` or visible asterisk | 3.3.2 | Non-blocking | The label says "Email" with no required indicator |
| S4 | Error message for invalid email not linked via `aria-describedby` | 3.3.1 | Blocking | Screen reader users won't hear the error |
| S5 | Modal does not return focus to its trigger when closed | 2.4.3 | Non-blocking | Hard for static analysis to catch — listed for completeness |

**Correct patterns:**
- The notification preferences section uses `<fieldset>` and `<legend>` correctly
- The save button has visible text and is a `<button>` element

---

## Summary

| Severity | Count | WCAG criteria touched |
|----------|-------|------------------------|
| Blocking | 8 | 1.1.1, 1.3.1, 1.4.1, 3.3.1, 3.3.2, 4.1.2 (×2), 2.1.1 |
| Non-blocking | 7 | 1.3.1, 1.4.11, 2.4.3, 2.4.4, 2.4.10, 3.3.2 |
| False-positive bait | 1 | 1.4.1 |

A well-tuned bot should catch all 8 blocking issues with high confidence, surface most of the 7 non-blocking with appropriate uncertainty, and not flag the correct patterns.
