import { combineLatest, map } from "rxjs";
import type { Observable } from "rxjs";
import type {
  SubstateMutationInitializer,
  SubstateSelectorInitializer,
  SubstateSubscriptionInitializer,
  SubstateSubStore,
  SubstateSubStoreSnapshot,
  SubstateSubStoreSnapshotUnsafe,
} from "./types";

export function throwIfSubstateDependenciesNotInitializedOrNotAllowed(
  dependencies: SubstateSubStore,
) {
  Object.entries(dependencies).find(([key, dependency]) => {
    if (!dependency.isInitialized()) {
      throw new Error(
        `Dependency associated with key ${key} is not initialized`,
      );
    }

    if (dependency.length > 1) {
      throw new Error(
        `Dependency associated with key ${key} is not allowed (isolated)`,
      );
    }
  });
}

export function listenSubstateDependencies(
  dependencies: SubstateSubStore,
): Observable<void> {
  throwIfSubstateDependenciesNotInitializedOrNotAllowed(dependencies);

  return combineLatest(
    Object.values(dependencies).map((dependency) => {
      return (
        dependency as
          | SubstateSelectorInitializer<any>
          | SubstateMutationInitializer<any, any>
          | SubstateSubscriptionInitializer<any, any>
      )().stream();
    }),
  ).pipe(
    map((results) => {
      void results;
    }),
  );
}

export function getSubstateDependenciesUnsafe<S extends SubstateSubStore>(
  dependencies: S,
): SubstateSubStoreSnapshotUnsafe<S> {
  throwIfSubstateDependenciesNotInitializedOrNotAllowed(dependencies);

  return Object.fromEntries(
    Object.entries(dependencies).map(([key, dependency]) => [
      key,
      (
        dependency as
          | SubstateSelectorInitializer<any>
          | SubstateMutationInitializer<any, any>
          | SubstateSubscriptionInitializer<any, any>
      )().latest(),
    ]),
  ) as SubstateSubStoreSnapshotUnsafe<S>;
}

export async function resolveSubstateDependencies(
  dependencies: SubstateSubStore,
): Promise<void> {
  throwIfSubstateDependenciesNotInitializedOrNotAllowed(dependencies);

  await Promise.all(
    Object.values(dependencies).map(async (dependency) => {
      const flow = (
        dependency as
          | SubstateSelectorInitializer<any>
          | SubstateMutationInitializer<any, any>
          | SubstateSubscriptionInitializer<any, any>
      )();

      if ("resolve" in flow && !flow.latest().ready) {
        await flow.resolve();
      }
    }),
  );
}

export function castSubstateDependenciesToData<S extends SubstateSubStore>(
  dependencies: SubstateSubStoreSnapshotUnsafe<S>,
): SubstateSubStoreSnapshot<S> {
  return Object.fromEntries(
    Object.entries(dependencies).map(([key, result]) => {
      if (!result.ready || !result.success) {
        throw new Error(
          `Dependency associated with key ${key} is not ready or not successful`,
        );
      }

      return [key, result.data];
    }),
  ) as SubstateSubStoreSnapshot<S>;
}

export function getSubstateDependencies<S extends SubstateSubStore>(
  dependencies: S,
): SubstateSubStoreSnapshot<S> {
  throwIfSubstateDependenciesNotInitializedOrNotAllowed(dependencies);

  return castSubstateDependenciesToData(
    getSubstateDependenciesUnsafe(dependencies),
  );
}
