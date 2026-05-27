# @substate/react

`@substate/react` provides typed React bindings for stores created with `@substate/core`.

## Installation

```bash
npm install @substate/core @substate/react react
```

## Quick Start

Create typed bindings for your store type:

```tsx
import { createCascadeStore, createCascadeSubStore } from "@substate/core";
import { createSubstateReact } from "@substate/react";

const counter = createCascadeSubStore({}, (builder) => {
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

const store = createCascadeStore({ counter });

type AppStore = typeof store;

export const { Provider: SubstateProvider, useState: useSubstate } =
  createSubstateReact<AppStore>();
```

Add the provider to your app:

```tsx
<SubstateProvider store={store}>
  <App />
</SubstateProvider>
```

Read or run a flow from a component:

```tsx
function Counter() {
  const [doubled, resolveDoubled, doubledStatus] = useSubstate((store) =>
    store.counter.doubled(),
  );
  const [count, setCount] = useSubstate((store) => store.counter.setCount());

  return (
    <button
      disabled={doubledStatus.fetching}
      onClick={async () => {
        await setCount({ value: 2 });
        await resolveDoubled();
      }}
    >
      {doubled?.value ?? count?.value ?? 0}
    </button>
  );
}
```

The hook returns:

```ts
[
  data,
  fetch,
  {
    ready,
    fetching,
    success,
    error,
  },
];
```
