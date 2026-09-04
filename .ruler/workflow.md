# Workflow

## Workflow Expectations

- **Default branch:** `main`; land changes via pull request when collaborating
- **Before commit:** `pnpm fix` (and `pnpm check` / `pnpm check-types` when touching types or config)
- **Conventional commits:** Prefer `feat:`, `fix:`, `docs:`, etc., for changelog clarity
- **Reviews:** Follow code-standards.md; keep PRs focused; document env or setup changes in README / AGENTS as needed

## Documentation Duties

- Update root **README.md** when setup steps, ports, or key commands change.
- Update **AGENTS.md** in the touched app/package when structure, entry points, or common tasks change.
- Keep `.env.example` and `packages/env` in sync with new required variables.
- See [Production checklist](notes/production-checklist.md) and `.kiro/specs/` for launch and feature docs.

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update README or relevant AGENTS.md if you changed setup, commands, or structure.
- [ ] Summarize changes in conventional commit form (e.g. `feat: ...`, `fix: ...`, `docs: ...`).

## Documentation Index

Full list of AGENTS.md files across the repo — see [README.md](./README.md) § Documentation for the complete table with descriptions.
