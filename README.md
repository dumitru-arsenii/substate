# Substate

Substate is a TypeScript-first open-source monorepo for reactive state packages published under the `@substate/*` npm scope.

The first package is `@substate/core`, a small runtime for composing typed substores from selectors, mutations, subscriptions, isolated selectors, dependency tracking, and snapshots.

- Repository: https://github.com/dumitru-arsenii/substate
- Issues: https://github.com/dumitru-arsenii/substate/issues
- Packages: published to npm under the `@substate/*` scope

## Packages

| Package           | Purpose                                     | Docs                                                   |
| ----------------- | ------------------------------------------- | ------------------------------------------------------ |
| `@substate/core`  | Reactive dependency-driven state primitives | [packages/core/README.md](./packages/core/README.md)   |
| `@substate/react` | Typed React provider and hooks              | [packages/react/README.md](./packages/react/README.md) |

Future packages can live beside it in `packages/*`, including framework adapters such as `@substate/vue` and tooling such as `@substate/devtools`.

## Installation

```bash
npm install @substate/core
```

## Quick Start

```ts
import { createStore, createSubStore } from "@substate/core";

const users = createSubStore({}, (builder) => {
  const setUser = builder.mutation(
    async (args: { id: number; name: string }) => args,
  );

  const currentUser = builder
    .withDependencies({ setUser })
    .selector(async ({ setUser }) => setUser);

  return { setUser, currentUser };
});

const store = createStore({ users });

await store.users.setUser().run({ id: 1, name: "Ada" });

const user = await store.users.currentUser().resolve();

console.log(user.name);
```

## Monorepo Development

Install dependencies:

```bash
pnpm install
```

Run all tests:

```bash
pnpm test
```

Run workspace typecheck:

```bash
pnpm typecheck
```

Build all packages:

```bash
pnpm build
```

Run one package test suite:

```bash
pnpm --filter @substate/core test
```

## Publishing

The repository includes an npm publish workflow:

- [GitHub publish workflow](./.github/workflows/publish-npm.yml)

Package-specific npm-facing documentation is included in each package README, and those READMEs are packed into the published tarballs.
