---
title: Running Templates
sidebar_position: 2
---

# Running Templates

**Templates** are multi-step workflows (e.g. create repo → add files → open PR) that you run from the UI. This page describes how to find a template, fill the form, start a run, and follow execution until completion.

## Find a template

1. In the main navigation, click **Templates** (or go to **/templates**).
2. You see a grid of **template cards**. Each card shows:
   - **Title** and **description**
   - **Tags** (if any)
   - A **"Create →"** button (visible only if your role can run templates — not for *viewer*).
3. Click **"Create →"** on the template you want. You are taken to **/templates/:id** (the template detail / run form page).

:::tip
If you do not see the "Create →" button, your role is *viewer*. You need at least *developer* (or higher) to run templates. See [Role Guide](/docs/user-guide/role-guide).
:::

## Fill the form

1. On the template page you see:
   - A short **header** with the template title, description, and tags.
   - A **preview** of what the template will do: a numbered list of steps (e.g. "Create repo", "Add README", "Open PR").
   - A **form** built from the template’s **parameters** (each parameter has a label, type, and optional description; required fields are enforced).
2. Fill in every **required** field. Optional fields can be left blank unless you need them.
3. Click the **submit** button (e.g. "Run template" or "Create").

:::warning
Invalid or missing required values will show an error. Fix the fields and submit again. If the API returns a validation error (e.g. invalid repo name), the message is shown on the page.
:::

## After you submit

1. The UI calls the API to **start the template run**. On success, you are **redirected** to **/templates/runs/:runId** (the run progress page).
2. The run page shows:
   - **Overall status** (e.g. Running, Success, Failed).
   - **Steps** in order: each step has a status (queued, running, success, failed), optional duration, and for completed steps **outputs** (e.g. `repoUrl`, `prUrl`). Failed steps show an error message and a short hint (e.g. SCM auth, rate limit, validation).
3. The page may **auto-refresh** or you can refresh manually to see the next step start or the run finish.
4. When the run is **successful**, you can use the outputs (e.g. open the new repo or PR link). When it **fails**, you can use **Retry** (if shown) to re-run the template with the same inputs, or go back to the template and run again with different values.

## See the output

- **Step outputs** are shown in a small code-style block under each successful step (e.g. `repoUrl`, `prUrl`, `branch`). Links are often clickable or copyable.
- **Final outputs** of the template (if defined) are typically reflected in the last step’s outputs or in a summary section. Use them to continue your workflow (e.g. open the PR in your browser).

:::tip
If a step fails with an SCM or auth error, an administrator must configure the correct tokens (e.g. `SCM_GITHUB_TOKEN`) and webhook/perms. See [Configuration — SCM providers](/docs/configuration/scm-providers).
:::
