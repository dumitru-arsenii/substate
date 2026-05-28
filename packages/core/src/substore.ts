import { createSubstateCleanBuilder } from "./builder";
import type {
  SubstateCleanBuilder,
  SubstateStoreSubStoresInitializers,
  SubstateSubStore,
  SubstateSubStoreFlowInitializers,
  SubstateSubStoreInitializer,
  SubstateSubStoreInitializerContext,
} from "./types";

export function createSubStore<
  S extends SubstateSubStore,
  D extends SubstateStoreSubStoresInitializers,
>(
  dependencies: D,
  factory: (
    builder: SubstateCleanBuilder,
    deps: SubstateSubStoreFlowInitializers<D>,
  ) => S,
): SubstateSubStoreInitializer<S> {
  let substore: S;
  let isInitialized = false;
  const uuid = `${Math.random().toString(36).substring(2, 9)}--${Math.random()
    .toString(36)
    .substring(2, 9)}`;

  return Object.assign(() => substore!, {
    isInitialized() {
      return isInitialized;
    },
    initialize(context: SubstateSubStoreInitializerContext) {
      substore = Object.fromEntries(
        Object.entries(
          factory(
            createSubstateCleanBuilder(),
            Object.fromEntries(
              Object.entries(dependencies).map(([depKey, dep]) => [
                depKey,
                dep(),
              ]),
            ) as SubstateSubStoreFlowInitializers<D>,
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
