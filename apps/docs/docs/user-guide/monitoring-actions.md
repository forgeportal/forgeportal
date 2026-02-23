---
title: Monitoring Action Runs
sidebar_position: 3
---

# Monitoring Action Runs

**Action runs** are individual step executions (create repo, open PR, etc.) that belong either to a **template run** or to a one-off action. This page describes how to list runs, filter by status, and open the template run to see logs and retry.

## Open the action runs list

1. In the main navigation, click **Actions** (or go to **/actions**).
2. You see the **Action Runs** page: a short description ("Recent action executions across all templates"), a **status filter** bar, then a **table** of runs.

## Status filter

- The filter bar shows chips: **All**, **queued**, **running**, **success**, **failed**, **canceled**.
- Click a chip to filter the list to that status. The active chip is highlighted (e.g. indigo). Click **All** to clear the filter.
- A **Refresh** button (e.g. "↻ Refresh") reloads the list without changing the filter.

## Table columns

| Column | Description |
|--------|-------------|
| **Status** | Badge: queued, running, success, failed, or canceled. |
| **Action / Step** | Step id or action id (e.g. `step-1`, `scm.createRepo@v1`). |
| **Requested By** | User who started the run (e.g. email). |
| **Started** | Relative time (e.g. "2m ago") or absolute. |
| **Duration** | Elapsed time for completed runs; "—" if still running or queued. |
| **Template Run** | If the run is part of a template run, a **"View run →"** link to that template run. |

Clicking **"View run →"** takes you to **/templates/runs/:runId**, where you see the full template run: all steps, logs, and outputs.

:::tip
There is no separate "action run detail" page with raw logs in the current UI. Step-level detail (including error messages and outputs) is on the **template run** page. Use "View run →" to get there.
:::

## View step detail and logs

1. From the action runs list, click **"View run →"** for a run that has a template run.
2. On the **template run** page you see each **step** in order. For each step:
   - **Status** (running, success, failed).
   - **Duration** (when finished).
   - **Outputs** (for success): e.g. `repoUrl`, `prUrl`, in a small code block.
   - **Error** (for failed): a short message and a **hint** (e.g. "Check SCM token", "Rate limit — wait a few minutes").
3. These step blocks are the "logs" for that action run. The backend also writes structured logs and audit entries; the UI exposes the step output and error text.

## Retry

- If the **template run** has **failed**, the run page may show a **Retry** button. Click it to re-start the same template with the **same user inputs**. This creates a new template run (and new action runs).
- There is no per–action-run "retry" in the UI; retry is at the template-run level. For one-off actions, run the action again from the place that triggered it (e.g. scorecard fix).

:::warning
Rate limits apply to action runs (e.g. 10 runs per minute per user). If you hit the limit, wait for the time indicated in the error (or the `Retry-After` window) before retrying.
:::
