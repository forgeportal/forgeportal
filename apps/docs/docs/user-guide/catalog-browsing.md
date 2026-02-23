---
title: Browsing the Catalog
sidebar_position: 1
---

# Browsing the Catalog

The **Catalog** is where you discover and inspect all entities (services, components, libraries, etc.) registered in ForgePortal. This page walks you through filters, search, the entity detail view, and tabs.

## Open the catalog

1. In the main navigation, click **Catalog** (or go to **/catalog**).
2. You land on the catalog list: a search bar at the top, filter bar below, then a table of entities (Name, Kind, Owner, Lifecycle, Tags).

:::tip
The home route (**/**) redirects to **/catalog**, so opening the portal usually shows the catalog first.
:::

## Search

- **Search box** — At the top of the catalog page, a single input with placeholder *"Search entities and docs…"*.
- As you type, the UI debounces and runs a **full-text search** across entities and indexed docs. Results appear as cards (entity or doc) with a short excerpt and relevance score.
- When the search query is non-empty, the filter bar and entity table are hidden; only search results are shown. Clear the search box to return to the filtered table view.

:::warning
Search requires the unified search API and doc indexing to be enabled. If no results appear, check that discovery and docs-index jobs have run for your repos.
:::

## Filters

When you are **not** in search mode, the **filter bar** is visible with:

| Filter | UI control | Effect |
|--------|------------|--------|
| **Kind** | Dropdown | Restricts to one kind: service, library, website, api, component, resource, system, domain, group, user, template (or "All kinds"). |
| **Lifecycle** | Dropdown | experimental, production, deprecated, or "All lifecycles". |
| **Owner** | Text input | Filters by owner reference (e.g. `team:platform`). Partial match depends on API. |
| **Tag** | Text input | Filters by tag (e.g. `payments`). |

- Changing any filter updates the URL query parameters and refreshes the table. **Clear filters** resets all filters.
- **Pagination** — Below the table you see "Showing X–Y of Z entities" and Previous / Next. Page size is fixed (e.g. 20); offset is stored in the URL.

## Open an entity

1. In the table, click a **row** (or the entity **name**). You are taken to **/catalog/:id** (entity detail page).
2. The entity detail page shows the entity name, kind, owner, lifecycle, tags, description, and links at the top, then a **tabbed** area.

## Entity tabs

On the entity detail page, the following tabs are available (order may vary):

| Tab | Content |
|-----|--------|
| **Overview** | Summary: metadata, SCM sources (repo URL, path), and key attributes. |
| **Dependencies** | Relations (e.g. dependsOn, partOf): links to other entities. |
| **Docs** | Documentation indexed from the repo (e.g. from `docs/`). List or viewer of markdown content. |
| **Scorecards** | Scorecard evaluations for this entity: levels (Bronze/Silver/Gold), per-rule pass/fail, and **Fix** actions. See [Scorecards & Fix Actions](/docs/user-guide/scorecards-and-fixes). |
| **Actions** | Placeholder for future action runs or quick actions tied to this entity. |
| **Plugin tabs** | If plugins register entity tabs, additional tabs appear (e.g. "PagerDuty", "Deployments"). |

Click a tab to switch content; the active tab is highlighted. Plugin tabs are rendered by the corresponding plugin package.

:::tip
If you see "No entities found", ensure discovery is configured (orgs in `forgeportal.yaml`) and at least one repo scan or webhook has run so entities exist in the catalog.
:::
