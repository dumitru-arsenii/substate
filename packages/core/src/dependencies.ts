import { combineLatest, map } from "rxjs";
import type { Observable } from "rxjs";
import type {
  CascadeMutationInitializer,
  CascadeSelectorInitializer,
  CascadeSubscriptionInitializer,
  CascadeSubStore,
  CascadeSubStoreSnapshot,
  CascadeSubStoreSnapshotUnsafe,
} from "./types";

export function throwIfCascadeDependenciesNotInitializedOrNotAllowed(
  dependencies: CascadeSubStore,
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

export function listenCascadeDependencies(
  dependencies: CascadeSubStore,
): Observable<void> {
  throwIfCascadeDependenciesNotInitializedOrNotAllowed(dependencies);

  return combineLatest(
    Object.values(dependencies).map((dependency) => {
      return (
        dependency as
          | CascadeSelectorInitializer<any>
          | CascadeMutationInitializer<any, any>
          | CascadeSubscriptionInitializer<any, any>
      )().stream();
    }),
  ).pipe(
    map((results) => {
      void results;
    }),
  );
}

export function getCascadeDependenciesUnsafe<S extends CascadeSubStore>(
  dependencies: S,
): CascadeSubStoreSnapshotUnsafe<S> {
  throwIfCascadeDependenciesNotInitializedOrNotAllowed(dependencies);

  return Object.fromEntries(
    Object.entries(dependencies).map(([key, dependency]) => [
      key,
      (
        dependency as
          | CascadeSelectorInitializer<any>
          | CascadeMutationInitializer<any, any>
          | CascadeSubscriptionInitializer<any, any>
      )().latest(),
    ]),
  ) as CascadeSubStoreSnapshotUnsafe<S>;
}

export async function resolveCascadeDependencies(
  dependencies: CascadeSubStore,
): Promise<void> {
  throwIfCascadeDependenciesNotInitializedOrNotAllowed(dependencies);

  await Promise.all(
    Object.values(dependencies).map(async (dependency) => {
      const flow = (
        dependency as
          | CascadeSelectorInitializer<any>
          | CascadeMutationInitializer<any, any>
          | CascadeSubscriptionInitializer<any, any>
      )();

      if ("resolve" in flow && !flow.latest().ready) {
        await flow.resolve();
      }
    }),
  );
}

export function castCascadeDependenciesToData<S extends CascadeSubStore>(
  dependencies: CascadeSubStoreSnapshotUnsafe<S>,
): CascadeSubStoreSnapshot<S> {
  return Object.fromEntries(
    Object.entries(dependencies).map(([key, result]) => {
      if (!result.ready || !result.success) {
        throw new Error(
          `Dependency associated with key ${key} is not ready or not successful`,
        );
      }

      return [key, result.data];
    }),
  ) as CascadeSubStoreSnapshot<S>;
}

export function getCascadeDependencies<S extends CascadeSubStore>(
  dependencies: S,
): CascadeSubStoreSnapshot<S> {
  throwIfCascadeDependenciesNotInitializedOrNotAllowed(dependencies);

  return castCascadeDependenciesToData(
    getCascadeDependenciesUnsafe(dependencies),
  );
}
