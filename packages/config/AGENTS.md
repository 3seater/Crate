# Config Package

> Scope: `packages/config` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

Shared TypeScript configuration for the monorepo.

## Quick Facts

- **Package:** `@doji/config`
- **Key file:** `tsconfig.base.json` (no build/test scripts; consumed via `extends`)

## Purpose

Provides `tsconfig.base.json` used by all packages and apps via `extends`.

## Structure

```
tsconfig.base.json   # Base compiler options
package.json         # Package manifest
```

## Usage

In any package `tsconfig.json`:

```json
{
  "extends": "@doji/config/tsconfig.base.json"
}
```

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if base compiler options or extends contract change.
- [ ] Summarize changes in conventional commit form (e.g. `chore(config): ...`).

## Related

- [Root tsconfig](../../tsconfig.json)
- [Turbo config](../../turbo.json)
