---
title: Scorecards & Fix Actions
sidebar_position: 4
---

# Scorecards & Fix Actions

**Scorecards** evaluate entities against governance rules (e.g. "must have an owner", "must have a README"). Each rule has a **level** (Bronze, Silver, Gold). When a rule fails, you can trigger a **fix action** (e.g. open a PR to add the file). This page describes how to read scorecard results and run a fix.

## Where to see scorecards

1. Open an **entity** from the catalog (**/catalog/:id**).
2. Click the **Scorecards** tab.
3. You see one **block per scorecard** that applies to this entity (e.g. by kind). Each block shows the scorecard name, overall **level** (or "pending"), and the list of **rules** with pass/fail state.

## Reading the scorecard block

- **Header**: Scorecard name and a short summary (e.g. "3/5 rules passing" and "evaluated 5m ago"). A **level badge** (Bronze, Silver, Gold, or pending) is shown.
- **Rules**: Each rule is a row with:
  - **Icon**: ✓ (pass), ✗ (fail), or ⏳ (not yet evaluated).
  - **Rule title** (e.g. "Owner is set", "README exists").
  - **Level** badge for that rule (Bronze / Silver / Gold).
  - **Fix** button — only for **failing** rules that have a fix action defined, and only if your role can run actions (not *viewer*). If the rule has an evaluation error, the error text is shown instead.

:::tip
Levels are ordered: Bronze (lowest) → Silver → Gold (highest). The **achieved level** is the highest level for which **all** rules at that level pass. So if one Gold rule fails, the achieved level might be Silver.
:::

## Triggering a fix

1. Find a **failing** rule that shows a **"Fix →"** button.
2. Click **Fix →**. A **dialog** opens with:
   - The rule title and scorecard name.
   - A short description of what will happen (e.g. "Create file `README.md` on a fix branch and open a Pull Request").
   - A note that a PR will be opened and no direct push to the default branch.
3. Click **Confirm** (or the primary button). The UI calls the API to start the **fix template run** (e.g. a template that runs the suggested action and opens a PR).
4. You are **redirected** to **/templates/runs/:runId** so you can follow the run. When it succeeds, open the PR link from the step outputs to review and merge.

:::warning
Fix actions require SCM credentials and permissions (e.g. create branch, open PR). If the fix run fails with an auth or permission error, an administrator must configure the correct token and repo access.
:::

## Following the PR

- On the template run page, the step that opens the PR will have an output like **prUrl** (or **link**). Open that URL in your browser to see the PR in GitHub or GitLab.
- Merge the PR when ready. The next scorecard evaluation (scheduled or manual) will re-check the entity; the rule should pass if the fix was correct (e.g. README added).

:::tip
Evaluations can be **cached** for a short time. If you just merged the fix PR, the scorecard might still show "fail" until the cache expires or an admin triggers a re-evaluation. Use "Re-evaluate" (if available) or wait for the next evaluation cycle.
:::
