---
title: forge sync — Plugin Dependency Sync
sidebar_position: 5
---

# `forge sync` — Plugin Dependency Sync

`forge sync` is a CLI command shipped with `@forgeportal/cli` that **automatically synchronises plugin dependencies** declared in `forgeportal.yaml` into `apps/api/package.json` and `apps/ui/package.json`.

It eliminates the need to manually add or remove plugin packages from two separate `package.json` files when plugins change.

---

## How it works

1. Reads `pluginPackages.packages` from `forgeportal.yaml`.
2. For each package, resolves its plugin type (`ui`, `backend`, `fullstack`) by reading its `forgeportal-plugin.json` manifest:
   - **Workspace packages** (`packages/*`) → version pinned to `workspace:*`.
   - **Installed packages** (in `node_modules`) → version pinned to `^x.y.z`.
   - **External packages** (not installed) → fetched from the npm registry.
3. Computes a diff against the current `dependencies` in both `package.json` files:
   - **`fullstack`** plugins → added to both `api` and `ui`.
   - **`backend`** plugins → added to `api` only.
   - **`ui`** plugins → added to `ui` only.
4. Plugins no longer in `forgeportal.yaml` are **removed** from both files.
5. Writes the updated files and runs `pnpm install` (unless `--ci` or `--dry-run`).

:::info Non-plugin deps are never touched
Only packages matching the pattern `@forgeportal/plugin-*` or `forge-plugin-*` are ever removed. Your other dependencies are safe.
:::

---

## Usage

### Default — sync + install

```bash
pnpm forge:sync
```

Reads `forgeportal.yaml`, updates `package.json` files, and runs `pnpm install`.

### Dry run — preview changes

```bash
pnpm forge:sync --dry-run
```

Prints what would change without writing any file or running install.

### CI mode — sync without install

```bash
pnpm forge:sync --ci
```

Updates `package.json` files but skips `pnpm install`. Use in Dockerfiles where you run `pnpm install --frozen-lockfile` separately in an earlier stage.

### Check mode — CI gate

```bash
pnpm forge:sync --check
```

Exits with code `1` if `package.json` files are out of sync with `forgeportal.yaml`. Use as a CI step to enforce that engineers run `forge sync` after editing `forgeportal.yaml`.

```yaml
# Example GitHub Actions step
- name: Check plugin deps in sync
  run: pnpm forge:sync --check
```

---

## `forgeportal.yaml` reference

```yaml
pluginPackages:
  packages:
    - "@forgeportal/plugin-kubernetes"
    - "@myorg/forge-plugin-pagerduty"
```

Each entry must be a valid npm package name whose published package (or workspace package) contains a `forgeportal-plugin.json` manifest.

---

## Docker / Dockerfile usage

In a multi-stage Dockerfile, run `forge sync --ci` in the final stage **after** your build stage, so plugins declared in `forgeportal.yaml` at runtime are added to the image:

```dockerfile
# Stage 1: full build
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: runtime
FROM node:22-alpine AS api
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/forgeportal.yaml ./
# forge sync adds plugin packages listed in forgeportal.yaml
RUN pnpm forge:sync --ci
RUN pnpm install --frozen-lockfile
```

---

## Programmatic API

The sync logic is exported from `@forgeportal/cli` for use in scripts or other tooling:

```ts
import { syncCommand } from '@forgeportal/cli/commands/sync';

const result = await syncCommand({
  root:    '/path/to/project',
  dryRun:  false,
  ci:      true,
  check:   false,
});

console.log(result.apiAdded);   // packages added to api
console.log(result.uiAdded);    // packages added to ui
console.log(result.changed);    // true if any change was made
```

### `SyncOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `root` | string | `process.cwd()` | Project root (must contain `forgeportal.yaml`). |
| `configPath` | string | `<root>/forgeportal.yaml` | Override config file path. |
| `dryRun` | boolean | `false` | Print diff, do not write. |
| `ci` | boolean | `false` | Write files, skip `pnpm install`. |
| `check` | boolean | `false` | Exit 1 if out of sync. |

### `SyncResult`

| Field | Type | Description |
|-------|------|-------------|
| `apiAdded` | string[] | Package names added to `apps/api`. |
| `apiRemoved` | string[] | Package names removed from `apps/api`. |
| `uiAdded` | string[] | Package names added to `apps/ui`. |
| `uiRemoved` | string[] | Package names removed from `apps/ui`. |
| `changed` | boolean | `true` if any file was modified. |

---

## Resolution priority

When resolving a plugin's version and type, `forge sync` checks in this order:

1. **Workspace package** — `packages/<dirname>/forgeportal-plugin.json` matching the package name → `workspace:*`
2. **`node_modules`** — resolved via `require.resolve('<pkg>/package.json')` → `^<version>`
3. **npm registry** — `npm view <pkg> version` + `npm view <pkg> forgeportal` → `^<version>`

This ensures workspace members always get pinned to `workspace:*` even if they are also symlinked in `node_modules`.
