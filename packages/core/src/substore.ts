import { createCascadeCleanBuilder } from "./builder";
import type {
  CascadeCleanBuilder,
  CascadeStoreSubStoresInitializers,
  CascadeSubStore,
  CascadeSubStoreFlowInitializers,
  CascadeSubStoreInitializer,
  CascadeSubStoreInitializerContext,
} from "./types";

export function createCascadeSubStore<
  S extends CascadeSubStore,
  D extends CascadeStoreSubStoresInitializers,
>(
  dependencies: D,
  factory: (
    builder: CascadeCleanBuilder,
    deps: CascadeSubStoreFlowInitializers<D>,
  ) => S,
): CascadeSubStoreInitializer<S> {
  let substore: S;
  let isInitialized = false;
  const uuid = `${Math.random().toString(36).substring(2, 9)}--${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  return Object.assign(() => substore!, {
    isInitialized() {
      return isInitialized;
    },
    initialize(context: CascadeSubStoreInitializerContext) {
      substore = Object.fromEntries(
        Object.entries(
          factory(
            createCascadeCleanBuilder(),
            Object.fromEntries(
              Object.entries(dependencies).map(([depKey, dep]) => [
                depKey,
                dep(),
              ]),
            ) as CascadeSubStoreFlowInitializers<D>,
          ),
        ).map(([flowKey, flow]) => {
          if ("initialize" in flow) {
            flow.initialize({
              flowKey,
              ...context,
              initialData: context.initialData?.[flowKey],
            });
          }

          return [flowKey, flow];
        }),
      ) as S;
      isInitialized = true;
    },
    uuid() {
      return uuid;
    },
    getDependenciesUuids() {
      return Object.values(dependencies).map((dep) => dep.uuid());
    },
  });
}
