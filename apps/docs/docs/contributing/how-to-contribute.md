---
title: How to Contribute
sidebar_position: 1
---

# How to Contribute

ForgePortal is an open-source project and contributions are welcome — from bug fixes and tests to documentation improvements and new features. This guide describes the workflow for contributing code, docs, or plugins.

---

## Before you start

- **Read the [Architectural Decisions](/docs/contributing/architectural-decisions)** to understand the key design choices.
- **Check open issues** on GitHub for existing work or filed bugs before opening a new one.
- **Open an issue first** for non-trivial features or breaking changes, to agree on the approach before investing in an implementation.

---

## Development setup

Follow the [Local Dev Setup](/docs/getting-started/local-dev-setup) guide to get the full stack running locally. The short version:

```bash
git clone https://github.com/forgeportal/forgeportal.git
cd forgeportal
pnpm install
pnpm --filter @forgeportal/db run migrate    # run migrations
pnpm dev                                     # starts API + Worker + UI
```

Prerequisites: **Node 22+**, **pnpm 9+**, **Docker** (for PostgreSQL via `docker-compose`).

---

## Git workflow

1. **Fork** the repo (or clone directly if you have access).
2. **Create a branch** from `main`:

   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/issue-123
   ```

3. **Make changes**, write tests, and ensure CI passes locally (see below).
4. **Push** and open a **Pull Request** to `main`.
5. Address review comments; once approved, a maintainer merges.

### Branch naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-name>` | `feat/plugin-sdk-context-api` |
| Bug fix | `fix/<issue-or-desc>` | `fix/webhook-signature-gitlab` |
| Documentation | `docs/<topic>` | `docs/oidc-setup-cognito` |
| Chore | `chore/<desc>` | `chore/update-fastify-5` |
| Refactor | `refactor/<desc>` | `refactor/catalog-service-split` |

---

## Code style

- **TypeScript**: strict mode, no `any` without justification.
- **Formatting**: Prettier is configured at the repo root; run `pnpm format` to format all files.
- **Linting**: ESLint; run `pnpm lint` in each affected package. Fix all errors before submitting.
- **Imports**: use explicit file extensions (`.js`) for local imports (ESM).
- **Comments**: only for non-obvious intent; avoid narrating what the code does.

---

## Tests

Tests are in `src/__tests__/` within each package. Run in a specific package:

```bash
pnpm --filter @forgeportal/catalog test
```

Run all tests:

```bash
pnpm test
```

- **Unit tests**: prefer mocking DB/external calls with `vitest` mocks.
- **Integration tests**: use real Postgres via `docker-compose` or a test DB. Many tests use `buildApp()` with an in-memory DB.
- **Coverage**: no hard threshold, but meaningful coverage for new logic is expected.

All tests must pass before a PR is merged.

---

## Commit messages

Follow **Conventional Commits** (loosely):

```
<type>(<scope>): <short summary>

[optional body]
```

Examples:

```
feat(catalog): add lifecycle filter to entity list
fix(webhooks): fix GitLab signature check when body is empty
docs(oidc-setup): add Azure AD guide
chore(deps): update fastify to 5.3.3
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `ci`, `build`.

---

## Pull request process

1. **Title**: follows the same convention as commit messages.
2. **Description**: explain *what* and *why* (not just what the diff shows). Link the related issue.
3. **Tests**: include tests for new logic or bug fixes.
4. **Docs**: update relevant documentation pages if behavior or config changes.
5. **One concern per PR**: keep PRs focused; split unrelated changes.

A maintainer will review within a few days. Small, focused PRs are reviewed faster.

---

## Documentation contributions

Documentation lives in `apps/docs/docs/`. Pages are Markdown (MDX supported).

- Edit an existing page directly and open a PR.
- For new pages, add the file in the appropriate folder and ensure it appears in the sidebar (Docusaurus picks up files in alphabetical order unless `sidebar_position` is set in frontmatter).
- Build and preview locally:

  ```bash
  pnpm --filter @forgeportal/docs-site start   # dev server with hot reload
  pnpm --filter @forgeportal/docs-site build   # production build (checks broken links)
  ```

---

## Plugin contributions

Plugins live outside the core repo (separate npm packages). To contribute a plugin:

1. Scaffold with the CLI: `npx create-forge-plugin my-plugin --type ui|backend|fullstack`.
2. Develop and test locally as described in [Plugin Development](/docs/plugin-development/overview).
3. Publish to npm (or a private registry).
4. If the plugin is a useful community contribution, open an issue or PR to link it from the docs.

---

## Reporting bugs

Open an issue on GitHub with:
- ForgePortal version (or commit hash).
- Steps to reproduce.
- Actual vs. expected behavior.
- Relevant logs (redact secrets).

---

## Questions and discussion

For questions, use GitHub Discussions (when enabled) or open an issue with the `question` label.
