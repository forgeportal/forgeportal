---
title: Role-Based Access Guide
sidebar_position: 5
---

# Role-Based Access Guide

ForgePortal uses **role-based access control (RBAC)**. Your role is assigned by an administrator (via the Admin → Permissions area or your IdP group mapping) and determines which actions you can perform. This page lists the five roles and their permissions.

## The five roles

| Role | Typical use | Scope |
|------|-------------|--------|
| **platform-admin** | Full platform control: admin UI, users, settings, plugins, integrations. | Global. |
| **template-admin** | Manage templates and scorecards; run templates and actions; read entities and docs. Cannot manage users or admin settings. | Global. |
| **team-admin** | Create/update entities, run templates and actions, read scorecards and docs. Cannot create/update/delete templates or scorecards. | Often scoped to a team (by entity ownership or future scope). |
| **developer** | Read catalog, run templates and actions, read scorecards and docs. Cannot create or edit entities, templates, or scorecards. | General developers. |
| **viewer** | Read-only: catalog, templates (metadata), action list, scorecards, docs. Cannot run templates or actions. | Auditors, read-only users. |

:::tip
Role hierarchy (for display or future use): *platform-admin* &gt; *template-admin* &gt; *team-admin* &gt; *developer* &gt; *viewer*. Higher roles have at least the permissions of lower roles where it applies.
:::

## Permissions matrix

The table below is derived from the RBAC configuration. A ✓ means that role has the permission; a — means it does not.

| Permission | platform-admin | template-admin | team-admin | developer | viewer |
|------------|:--------------:|:--------------:|:----------:|:---------:|:------:|
| **Catalog & entities** | | | | | |
| entity:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| entity:create | ✓ | ✓ | ✓ | — | — |
| entity:update | ✓ | ✓ | ✓ | — | — |
| entity:delete | ✓ | — | — | — | — |
| **Templates** | | | | | |
| template:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| template:create | ✓ | ✓ | — | — | — |
| template:update | ✓ | ✓ | — | — | — |
| template:delete | ✓ | ✓ | — | — | — |
| template:run | ✓ | ✓ | ✓ | ✓ | — |
| **Actions** | | | | | |
| action:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| action:run | ✓ | ✓ | ✓ | ✓ | — |
| **Scorecards** | | | | | |
| scorecard:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| scorecard:create | ✓ | ✓ | — | — | — |
| scorecard:update | ✓ | ✓ | — | — | — |
| scorecard:delete | ✓ | ✓ | — | — | — |
| scorecard:evaluate | ✓ | ✓ | — | — | — |
| **Docs** | | | | | |
| docs:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Integrations** | | | | | |
| integration:read | ✓ | ✓ | — | — | — |
| integration:manage | ✓ | — | — | — | — |
| **Admin** | | | | | |
| admin:users | ✓ | — | — | — | — |
| admin:settings | ✓ | — | — | — | — |
| admin:plugins | ✓ | — | — | — | — |
| **Audit** | | | | | |
| audit:read | ✓ | — | — | — | — |

## Who uses which role?

- **platform-admin** — SREs or platform team leads who configure the portal, OIDC, SCM, plugins, and user/role assignments. Only they see the **Admin** menu (Integrations, Permissions, Plugins, Scan).
- **template-admin** — People who define golden-path templates and scorecards (e.g. "Create service", "Must have README"). They can run templates and fix actions too.
- **team-admin** — Team leads who register and update their team’s entities and run templates; they do not define templates or scorecards.
- **developer** — Engineers who browse the catalog, run templates to create repos/PRs, and check scorecards. They cannot create or edit entities or templates.
- **viewer** — Read-only access for compliance, auditors, or external stakeholders. They can open the catalog, templates list, action runs, and scorecards but cannot run anything.

## How your role is set

- **OIDC**: Your IdP groups (or roles) are mapped to ForgePortal roles in config (e.g. `auth.roleMapping`). When you log in, your role is resolved from your groups.
- **Admin UI**: A *platform-admin* can assign roles in **Admin → Permissions** by adding entries (subject ref, role, optional scope). Subject refs are typically `user:email` or `team:slug`.

If you believe your role is wrong, contact your administrator or check the configured role mapping and permissions entries.
