import type { Observable } from "rxjs";
import { createSubstateInitializer } from "./initializer";
import { createSubstateMutationFlow } from "./mutation.flow";
import { createSubstateSelectorFlow } from "./selector.flow";
import { createSubstateSubscriptionFlow } from "./subscription.flow";
import type {
  SubstateArgs,
  SubstateBaseFlowContext,
  SubstateBuilderWithDependencies,
  SubstateCleanBuilder,
  SubstateData,
  SubstateFlowInitializerContext,
  SubstateIsolatedInitializer,
  SubstateMutation,
  SubstateMutationInitializer,
  SubstateSelector,
  SubstateSelectorInitializer,
  SubstateSubscription,
  SubstateSubscriptionInitializer,
  SubstateSubStore,
  SubstateSubStoreSnapshot,
  SubstateSubStoreSnapshotUnsafe,
} from "./types";
import {
  castSubstateDependenciesToData,
  getSubstateDependencies,
  getSubstateDependenciesUnsafe,
  resolveSubstateDependencies,
} from "./dependencies";
import { getArgsKey } from "./utils";

export function createSubstateCleanBuilder(): SubstateCleanBuilder {
  const createBaseFlowContext = <T extends SubstateData>(
    context: SubstateFlowInitializerContext<T>,
  ): SubstateBaseFlowContext<T> => {
    return {
      dependencies: {},
      filterFn: () => true,
      initialData: context.initialData,
      substoreKey: context.substoreKey,
      flowKey: context.flowKey,
    };
  };

  return {
    withDependencies(dependencies) {
      return createSubstateBuilderWithDependencies(dependencies);
    },
    selector<T extends SubstateData>(handler: () => T | Promise<T>) {
      let flow: SubstateSelector<T>;
      return createSubstateInitializer(
        () => flow!,
        (context) => {
          flow = createSubstateSelectorFlow({
            ...createBaseFlowContext(context),
            handler: context.tracker.wrapExecution(
              async () => handler(),
              context.substoreKey,
              context.flowKey,
            ),
          });
        },
      ) as SubstateSelectorInitializer<T>;
    },
    mutation<T extends SubstateData, A extends SubstateArgs>(
      handler: (args: A) => T | Promise<T>,
    ) {
      let flow: SubstateMutation<T, A>;

      return createSubstateInitializer(
        () => flow!,
        (context) => {
          flow = createSubstateMutationFlow({
            ...createBaseFlowContext(context),
            handler: context.tracker.wrapExecution(
              async (args: A) => handler(args),
              context.substoreKey,
              context.flowKey,
            ),
          });
        },
      ) as SubstateMutationInitializer<T, A>;
    },
    subscription<T extends SubstateData, A extends SubstateArgs>(
      handler: (args: A) => Observable<T>,
    ) {
      let flow: SubstateSubscription<T, A>;

      return createSubstateInitializer(
        () => flow!,
        (context) => {
          flow = createSubstateSubscriptionFlow({
            ...createBaseFlowContext(context),
            handler: context.tracker.wrapExecution(
              handler,
              context.substoreKey,
              context.flowKey,
            ),
          });
        },
      ) as SubstateSubscriptionInitializer<T, A>;
    },
    isolated<T extends SubstateData, A extends SubstateArgs>(
      handler: (args: A) => T | Promise<T>,
    ) {
      let ctx: SubstateFlowInitializerContext<SubstateData>;
      const selectorsMap = new Map<string, SubstateSelector<SubstateData>>();

      return createSubstateInitializer(
        (args: A) => {
          const argsKey = getArgsKey(args);

          if (!selectorsMap.has(argsKey)) {
            const { initialData, ...rest } = createBaseFlowContext(ctx);
            selectorsMap.set(
              argsKey,
              createSubstateSelectorFlow({
                ...rest,
                initialData: (initialData as Record<string, SubstateData>)?.[
                  argsKey
                ],
                handler: ctx.tracker.wrapExecution(
                  async () => handler(args),
                  ctx.substoreKey,
                  ctx.flowKey,
                  getArgsKey(args),
                ),
              }),
            );
          }

          return selectorsMap.get(argsKey)!;
        },
        (context) => {
          ctx = context;
        },
      ) as SubstateIsolatedInitializer<T, A>;
    },
  };
}

export function createSubstateBuilderWithDependencies<
  D extends SubstateSubStore,
>(
  dependencies: D,
  filterFns: ((
    dependencies: SubstateSubStoreSnapshotUnsafe<D>,
  ) => boolean)[] = [],
): SubstateBuilderWithDependencies<D> {
  const allDependenciesReady = (
    dependencies: SubstateSubStoreSnapshotUnsafe<D>,
  ) => {
    return Object.values(dependencies).every((dep) => dep.ready && dep.success);
  };

  const createBaseFlowContext = <T extends SubstateData>(
    context: SubstateFlowInitializerContext<T>,
    additionalFilterFn?: (
      dependencies: SubstateSubStoreSnapshotUnsafe<D>,
    ) => boolean,
  ): SubstateBaseFlowContext<T> => {
    return {
      dependencies,
      filterFn: () => {
        try {
          const deps = getSubstateDependenciesUnsafe(dependencies);

          return [
            ...filterFns,
            additionalFilterFn ? additionalFilterFn : () => true,
          ].every((fn) => fn(deps));
        } catch {
          return false;
        }
      },
      initialData: context.initialData,
      substoreKey: context.substoreKey,
      flowKey: context.flowKey,
    };
  };

  return {
    when(filterFn) {
      return createSubstateBuilderWithDependencies(dependencies, [
        ...filterFns,
        (dependencies) => {
          try {
            return filterFn(castSubstateDependenciesToData(dependencies));
          } catch (error) {
            return false;
          }
        },
      ]);
    },
    whenUnsafe(filterFn) {
      return createSubstateBuilderWithDependencies(dependencies, [
        ...filterFns,
        filterFn,
      ]);
    },
    selector<T extends SubstateData>(
      handler: (dependencies: SubstateSubStoreSnapshot<D>) => T | Promise<T>,
    ) {
      let flow: SubstateSelector<T>;
      return createSubstateInitializer(
        () => flow!,
        (context) => {
          const rest = createBaseFlowContext(context, allDependenciesReady);
          flow = createSubstateSelectorFlow({
            ...rest,
            handler: async () => {
              const deps = getSubstateDependencies(dependencies);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(deps);
            },
          });
        },
      ) as SubstateSelectorInitializer<T>;
    },
    selectorUnsafe<T extends SubstateData>(
      handler: (
        dependencies: SubstateSubStoreSnapshotUnsafe<D>,
      ) => T | Promise<T>,
    ) {
      let flow: SubstateSelector<T>;
      return createSubstateInitializer(
        () => flow!,
        (context) => {
          const rest = createBaseFlowContext(context);
          flow = createSubstateSelectorFlow({
            ...rest,
            handler: async () => {
              const deps = getSubstateDependenciesUnsafe(dependencies);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(deps);
            },
          });
        },
      ) as SubstateSelectorInitializer<T>;
    },
    mutation<T extends SubstateData, A extends SubstateArgs>(
      handler: (
        args: A,
        dependencies: SubstateSubStoreSnapshot<D>,
      ) => T | Promise<T>,
    ) {
      let flow: SubstateMutation<T, A>;

      return createSubstateInitializer(
        () => flow!,
        (context) => {
          const rest = createBaseFlowContext(context, allDependenciesReady);
          flow = createSubstateMutationFlow({
            ...rest,
            handler: async (args: A) => {
              const deps = getSubstateDependencies(dependencies);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as SubstateMutationInitializer<T, A>;
    },
    mutationUnsafe<T extends SubstateData, A extends SubstateArgs>(
      handler: (
        args: A,
        dependencies: SubstateSubStoreSnapshotUnsafe<D>,
      ) => T | Promise<T>,
    ) {
      let flow: SubstateMutation<T, A>;

      return createSubstateInitializer(
        () => flow!,
        (context) => {
          const rest = createBaseFlowContext(context);
          flow = createSubstateMutationFlow({
            ...rest,
            handler: async (args: A) => {
              const deps = getSubstateDependenciesUnsafe(dependencies);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as SubstateMutationInitializer<T, A>;
    },
    subscription<T extends SubstateData, A extends SubstateArgs>(
      handler: (
        args: A,
        dependencies: SubstateSubStoreSnapshot<D>,
      ) => Observable<T>,
    ) {
      let flow: SubstateSubscription<T, A>;

      return createSubstateInitializer(
        () => flow!,
        (context) => {
          const rest = createBaseFlowContext(context, allDependenciesReady);
          flow = createSubstateSubscriptionFlow({
            ...rest,
            handler: (args: A) => {
              const deps = getSubstateDependencies(dependencies);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as SubstateSubscriptionInitializer<T, A>;
    },
    subscriptionUnsafe<T extends SubstateData, A extends SubstateArgs>(
      handler: (
        args: A,
        dependencies: SubstateSubStoreSnapshotUnsafe<D>,
      ) => Observable<T>,
    ) {
      let flow: SubstateSubscription<T, A>;

      return createSubstateInitializer(
        () => flow!,
        (context) => {
          const rest = createBaseFlowContext(context, allDependenciesReady);
          flow = createSubstateSubscriptionFlow({
            ...rest,
            handler: (args: A) => {
              const deps = getSubstateDependenciesUnsafe(dependencies);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as SubstateSubscriptionInitializer<T, A>;
    },
    isolated<T extends SubstateData, A extends SubstateArgs>(
      handler: (
        args: A,
        dependencies: SubstateSubStoreSnapshot<D>,
      ) => T | Promise<T>,
    ) {
      let ctx: SubstateFlowInitializerContext<SubstateData>;
      const selectorsMap = new Map<string, SubstateSelector<SubstateData>>();

      return createSubstateInitializer(
        (args: A) => {
          const argsKey = getArgsKey(args);

          if (!selectorsMap.has(argsKey)) {
            const { initialData, ...rest } = createBaseFlowContext(ctx);
            selectorsMap.set(
              argsKey,
              createSubstateSelectorFlow({
                ...rest,
                initialData: (initialData as Record<string, SubstateData>)?.[
                  argsKey
                ],
                handler: async () => {
                  await resolveSubstateDependencies(dependencies);

                  const deps = getSubstateDependencies(dependencies);

                  return ctx.tracker.wrapExecution(
                    handler,
                    ctx.substoreKey,
                    ctx.flowKey,
                    getArgsKey(args),
                  )(args, deps);
                },
              }),
            );
          }
          return selectorsMap.get(argsKey)!;
        },
        (context) => {
          ctx = context;
        },
      ) as SubstateIsolatedInitializer<T, A>;
    },
    isolatedUnsafe<T extends SubstateData, A extends SubstateArgs>(
      handler: (
        args: A,
        dependencies: SubstateSubStoreSnapshotUnsafe<D>,
      ) => T | Promise<T>,
    ) {
      let ctx: SubstateFlowInitializerContext<SubstateData>;
      const selectorsMap = new Map<string, SubstateSelector<SubstateData>>();

      return createSubstateInitializer(
        (args: A) => {
          const argsKey = getArgsKey(args);

          if (!selectorsMap.has(argsKey)) {
            const { initialData, ...rest } = createBaseFlowContext(ctx);
            selectorsMap.set(
              argsKey,
              createSubstateSelectorFlow({
                ...rest,
                initialData: (initialData as Record<string, SubstateData>)?.[
                  argsKey
                ],
                handler: async () => {
                  const deps = getSubstateDependenciesUnsafe(dependencies);

                  return ctx.tracker.wrapExecution(
                    handler,
                    ctx.substoreKey,
                    ctx.flowKey,
                    getArgsKey(args),
                  )(args, deps);
                },
              }),
            );
          }
          return selectorsMap.get(argsKey)!;
        },
        (context) => {
          ctx = context;
        },
      ) as SubstateIsolatedInitializer<T, A>;
    },
  };
}
