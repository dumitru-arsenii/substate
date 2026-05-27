import { setCascadeLogLevel } from "./logger";
import { createTracker } from "./tracker";
import type {
  CascadeLogLevel,
  CascadeStore,
  CascadeStoreSnapshot,
  CascadeStoreSubStoresInitializers,
} from "./types";
import { sortDepsInOrder } from "./utils";

export function createCascadeStore<
  S extends CascadeStoreSubStoresInitializers,
  T extends CascadeStoreSnapshot<S>,
>(substores: S, initialData?: T): CascadeStore<S> {
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
      setLogLevel: (level: CascadeLogLevel) => setCascadeLogLevel(level),
    },
  ) as CascadeStore<S>;
}
