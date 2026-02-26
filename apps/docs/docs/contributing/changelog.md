---
title: Changelog
sidebar_position: 3
---

# Changelog

ForgePortal follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

- [View full CHANGELOG on GitHub](https://github.com/forgeportal/forgeportal/blob/master/CHANGELOG.md)
- [GitHub Releases](https://github.com/forgeportal/forgeportal/releases)

---

## How we version

| Version bump | When |
|-------------|------|
| **Patch** (`1.0.x`) | Bug fixes, security patches, documentation updates |
| **Minor** (`1.x.0`) | New features, new plugins, non-breaking API/config changes |
| **Major** (`x.0.0`) | Breaking changes to config schema, REST API, or SDK contracts |

---

## Commit convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Changelog section | Version impact |
|--------|-------------------|----------------|
| `feat:` | Added | Minor bump |
| `fix:` | Fixed | Patch bump |
| `feat!:` / `BREAKING CHANGE:` | Breaking | Major bump |
| `docs:` | Documentation | No bump |
| `chore:`, `refactor:`, `perf:` | — | No bump |
| `plugin(name):` | Plugins | Minor bump |

### Examples

```bash
feat(catalog): add entity description to catalog list
fix(scorecards): handle null metric values correctly
feat!: rename forgeportal.yaml pluginConfig → plugins
docs(grafana): add allow_embedding troubleshooting section
```

---

## Release process

Releases are triggered by pushing a semver tag to `master`:

```bash
git tag v1.1.0
git push origin v1.1.0
```

This triggers the [release workflow](https://github.com/forgeportal/forgeportal/blob/master/.github/workflows/release.yml) which:

1. Runs the full CI suite (lint, build, test)
2. Builds and pushes Docker images to GHCR (`ghcr.io/forgeportal/forgeportal`)
3. Publishes npm packages (`@forgeportal/plugin-sdk`, `@forgeportal/cli`, plugins) to the npm registry
4. Creates a GitHub Release with auto-generated release notes

---

## Plugin versioning

First-party plugins (`@forgeportal/plugin-*`) are versioned independently from the core ForgePortal version. Each plugin's `package.json` contains its own semver version.

The `forgeportal-plugin.json` manifest declares an `engineVersion` constraint (e.g. `"^1.0.0"`) that is checked at startup against the installed `@forgeportal/plugin-sdk` version. Incompatible plugins are skipped with a warning.
