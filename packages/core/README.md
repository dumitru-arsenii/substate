# @substate/core

`@substate/core` is the first package in the Substate monorepo. It provides typed reactive store primitives built around substores, selectors, mutations, subscriptions, dependency tracking, and snapshots.

This package is published from the open-source Substate monorepo:

- Repository: https://github.com/dumitru-arsenii/substate
- Package source: https://github.com/dumitru-arsenii/substate/tree/main/packages/core
- npm: https://www.npmjs.com/package/@substate/core
- Issues: https://github.com/dumitru-arsenii/substate/issues

## Installation

```bash
npm install @substate/core
```

## Quick Start

```ts
import { createStore, createSubStore } from "@substate/core";

const counter = createSubStore({}, (builder) => {
  const setCount = builder.mutation(async (args: { value: number }) => ({
    value: args.value,
  }));

  const doubled = builder
    .withDependencies({ setCount })
    .selector(async ({ setCount }) => ({
      value: setCount.value * 2,
    }));

  return { setCount, doubled };
});

const store = createStore({ counter });

await store.counter.setCount().run({ value: 2 });

const result = await store.counter.doubled().resolve();

console.log(result.value); // 4
```

## Core API

### `createSubStore(dependencies, factory)`

Creates a substore definition. The factory receives a builder with methods for:

- `selector`
- `mutation`
- `subscription`
- `isolated`
- `withDependencies`

Substores can depend on other substores, and dependent flows can read ready dependency data through the builder.

### `createStore(substores, snapshot?)`

Initializes a store from substore definitions and optional snapshot data.

The returned store includes the initialized substores plus runtime helpers:

- `isPending()`
- `whenIdle()`
- `getSnapshot()`

### Results

Flow streams expose discriminated result objects:

```ts
type SubstateResult<T> =
  | { ready: false }
  | { ready: true; success: true; data: T }
  | { ready: true; success: false; error: unknown };
```

## Development

From the repository root:

```bash
pnpm install
pnpm --filter @substate/core test
pnpm --filter @substate/core typecheck
pnpm --filter @substate/core build
```
