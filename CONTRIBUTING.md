# Contributing to ForgePortal

Thank you for your interest in contributing to ForgePortal. This document explains how to get started, how we work, and what we expect from contributors.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Commit Conventions](#commit-conventions)
- [Branching Strategy](#branching-strategy)
- [Opening a Pull Request](#opening-a-pull-request)
- [Definition of Done](#definition-of-done)
- [Reporting Issues](#reporting-issues)
- [Security Vulnerabilities](#security-vulnerabilities)

---

## Code of Conduct

By participating in this project you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behaviour to **ahmed.b.daamer@gmail.com**.

---

## Getting Started

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | `>= 20.19` |
| pnpm | `10.x` |
| Docker + Docker Compose | any recent version |
| Git | `>= 2.40` |

### Fork & Clone

```bash
# Fork the repository on GitHub, then:
git clone https://github.com/<your-handle>/ForgePortal.git
cd ForgePortal
git remote add upstream https://github.com/bendaamerahmed/ForgePortal.git
```

---

## Development Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Copy environment variables

```bash
cp deployments/docker-compose/.env.example deployments/docker-compose/.env
# Edit .env and fill in required values (DB password, session secret, etc.)
```

### 3. Start the full stack

```bash
# API + Worker + UI + PostgreSQL — all hot-reloading
docker compose -f deployments/docker-compose/docker-compose.dev.yml up --build
```

The services will be available at:

| Service | URL |
|---------|-----|
| UI | http://localhost:3000 |
| API | http://localhost:3001 |
| Docs site | http://localhost:3002 |
| PostgreSQL | localhost:5432 |

### 4. Run without Docker (native)

```bash
# Start only PostgreSQL
docker compose -f deployments/docker-compose/docker-compose.dev.yml up postgres -d

# Run all apps/packages in watch mode
pnpm dev
```

### 5. Run tests

```bash
pnpm test            # all packages
pnpm --filter @forgeportal/api test   # single package
```

### 6. Lint & format

```bash
pnpm lint            # ESLint across the monorepo
pnpm format          # Prettier check
pnpm format:fix      # Prettier auto-fix
```

---

## Project Structure

```
ForgePortal/
├── apps/
│   ├── api/          # Fastify API server
│   ├── worker/       # Background job worker
│   ├── ui/           # React frontend
│   └── docs/         # Docusaurus documentation site
├── packages/
│   ├── core/         # Config, logging, DB client
│   ├── auth/         # OIDC, sessions, RBAC
│   ├── catalog/      # Entity CRUD, SCM providers, webhooks
│   ├── docs/         # Markdown renderer, FTS indexer
│   ├── scaffolder/   # Template engine, action runner
│   ├── scorecards/   # Rule engine, scorecard worker
│   └── plugin-sdk/   # Public SDK for plugin authors
├── tools/
│   └── create-forge-plugin/   # Plugin scaffolding CLI
├── deployments/
│   ├── docker-compose/
│   └── helm/
└── docs/             # Internal developer docs (committed)
```

For a full architecture overview see [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).

---

## Making Changes

1. **Sync your fork** before starting work:
   ```bash
   git fetch upstream
   git rebase upstream/master
   ```

2. **Create a feature branch** (see [Branching Strategy](#branching-strategy)).

3. **Write code** following the conventions in [`docs/DEVELOPER_GUIDE.md`](docs/DEVELOPER_GUIDE.md).

4. **Add or update tests** for every changed behaviour.

5. **Check the [Definition of Done](#definition-of-done)** before opening a PR.

---

## Commit Conventions

We follow **[Conventional Commits](https://www.conventionalcommits.org/)**.

### Format

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change with no behaviour difference |
| `test` | Adding or fixing tests |
| `chore` | Build tooling, dependency updates |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

### Scopes

Use the package or app name: `api`, `worker`, `ui`, `catalog`, `auth`, `scorecards`, `scaffolder`, `plugin-sdk`, `helm`, `docs`.

### Examples

```
feat(catalog): add GitLab subgroup support to repo discovery scanner
fix(auth): correct CSRF token validation on login redirect
docs(plugin-sdk): document createEntity helper
chore(deps): upgrade Fastify to 5.3.0
```

Breaking changes must include `BREAKING CHANGE:` in the footer:

```
feat(api)!: rename /api/v1/plugins to /api/v1/extensions

BREAKING CHANGE: All plugin API consumers must update their endpoint paths.
```

---

## Branching Strategy

| Branch | Purpose |
|--------|---------|
| `master` | Always deployable; protected |
| `feat/<scope>-<short-slug>` | New features |
| `fix/<scope>-<short-slug>` | Bug fixes |
| `docs/<short-slug>` | Documentation-only changes |
| `chore/<short-slug>` | Tooling / dependency updates |

Create branches from `master`:

```bash
git checkout -b feat/catalog-gitlab-subgroups
```

---

## Opening a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feat/catalog-gitlab-subgroups
   ```

2. Open a PR against `bendaamerahmed/ForgePortal:master`.

3. Fill in the PR template:
   - **What** — what changed and why.
   - **How to test** — steps to verify the change.
   - **Screenshots** — for UI changes.
   - **Checklist** — tick all items in the [Definition of Done](#definition-of-done).

4. Request a review. At least **one approving review** is required before merge.

5. Squash-and-merge is the default strategy to keep `master` history clean.

---

## Definition of Done

A PR is ready to merge when **all** of the following are true:

- [ ] Code compiles with no TypeScript errors (`pnpm build`)
- [ ] All existing tests pass (`pnpm test`)
- [ ] New behaviour is covered by unit or integration tests
- [ ] ESLint passes with no new errors (`pnpm lint`)
- [ ] No secrets, credentials, or personal data in committed files
- [ ] `CONTRIBUTING.md` / `docs/DEVELOPER_GUIDE.md` updated if the dev workflow changed
- [ ] Relevant story acceptance criteria are met and noted in the PR description
- [ ] PR title follows Conventional Commits format
- [ ] At least one approving review from a maintainer

---

## Reporting Issues

Before opening an issue:

1. Search [existing issues](https://github.com/bendaamerahmed/ForgePortal/issues) for duplicates.
2. Collect logs (`pnpm dev` output, Docker logs).
3. Note your environment (OS, Node version, Docker version).

Use the appropriate issue template:

- **Bug report** — unexpected behaviour with reproduction steps.
- **Feature request** — new capability with clear motivation.
- **Documentation** — missing or incorrect docs.

---

## Security Vulnerabilities

Do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the responsible disclosure process.
