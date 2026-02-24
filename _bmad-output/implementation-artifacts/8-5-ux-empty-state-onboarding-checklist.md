# Story 8-5: Empty-State Onboarding Checklist in the UI

**Epic:** 8 — Dogfooding & Adoption Validation  
**Status:** ready-for-dev  
**Priority:** P2  
**Estimate:** 3 points  
**Origin:** Dogfooding report finding [UX-001]

---

## User Story

As **Alex**, landing on ForgePortal for the first time with an empty catalog, I want a **setup checklist** on the home page that guides me through the first 3 steps, so I immediately know what to do next without reading the docs.

---

## Acceptance Criteria

- [ ] When the catalog contains **0 entities**, the Catalog page (and/or the home/dashboard page) shows an "Empty state" banner with a checklist:
  1. ✅ **Portal running** — "Your portal is live."
  2. ⬜ **Configure SCM** — "Add a GitHub or GitLab token in `forgeportal.yaml`" → link to SCM Providers docs.
  3. ⬜ **Trigger first scan** — "Go to Admin → Scan to discover your repositories." → links to `/admin/scan`.
  4. ⬜ **Create your first template** — "Use the Scaffolder to define golden-path services." → links to `/templates`.
- [ ] Each checklist item shows ✅ once the corresponding resource exists (SCM config detected via `/api/v1/admin/config/scm`, entities > 0, templates > 0).
- [ ] A "Dismiss" button hides the banner permanently (stored in `localStorage`).
- [ ] The banner is **not shown** when the catalog has ≥ 1 entity.
- [ ] The empty-state checklist is implemented as a standalone `SetupChecklist` component in `apps/ui/src/components/`.

---

## Out of scope

- Inline YAML editor or config wizard (future story).
- Checklist persistence in the database (localStorage is sufficient for MVP).
