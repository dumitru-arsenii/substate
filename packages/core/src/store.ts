import { createTracker } from "./tracker";
import type {
  SubstateStore,
  SubstateStoreSnapshot,
  SubstateStoreSubStoresInitializers,
} from "./types";
import { sortDepsInOrder } from "./utils";

export function createStore<
  S extends SubstateStoreSubStoresInitializers,
  T extends SubstateStoreSnapshot<S>,
>(substores: S, initialData?: T): SubstateStore<S> {
  const tracker = createTracker(initialData || ({} as any));
  const storeDeps = Object.entries(substores).map(([substoreKey, substore]) => {
    return {
      key: substoreKey,
      id: substore.uuid(),
      deps: substore.getDependenciesUuids(),
    };
  });

  sortDepsInOrder(storeDeps).forEach((substoreKey) => {
    const substore = substores[substoreKey]!;
    substore.initialize({
      tracker,
      substoreKey,
      initialData: (initialData as any)?.[substoreKey] || {},
    });
  });

  return Object.assign(
    Object.fromEntries(
      Object.entries(substores).map(([substoreKey, substore]) => [
        substoreKey,
        substore(),
      ]),
    ),
    {
      isPending: () => tracker.isPending(),
      whenIdle: () => tracker.whenIdle(),
      getSnapshot: () => tracker.getSnapshot(),
    },
  ) as SubstateStore<S>;
}
