# Substate Docs

This directory is reserved for guides that span multiple packages in the Substate monorepo.

Start with:

- [Repository README](../README.md)
- [`@substate/core` package docs](../packages/core/README.md)
- [`@substate/react` package docs](../packages/react/README.md)
- [Basic store example](../examples/basic-store/index.ts)

## Package Layout

Substate uses a pnpm workspace:

- `packages/core` contains `@substate/core`
- `packages/react` contains `@substate/react`
- future packages should be added under `packages/*`
- examples should be added under `examples/*`

Each publishable package owns its own `package.json`, `README.md`, `tsconfig.json`, `src`, and `test` directories.
