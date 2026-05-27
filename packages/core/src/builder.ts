import type { Observable } from "rxjs";
import { createCascadeInitializer } from "./initializer";
import { createCascadeMutationFlow } from "./mutation.flow";
import { createCascadeSelectorFlow } from "./selector.flow";
import { createCascadeSubscriptionFlow } from "./subscription.flow";
import type {
  CascadeArgs,
  CascadeBaseFlowContext,
  CascadeBuilderWithDependencies,
  CascadeCleanBuilder,
  CascadeData,
  CascadeFlowInitializerContext,
  CascadeIsolatedInitializer,
  CascadeMutation,
  CascadeMutationInitializer,
  CascadeSelector,
  CascadeSelectorInitializer,
  CascadeSubscription,
  CascadeSubscriptionInitializer,
  CascadeSubStore,
  CascadeSubStoreSnapshot,
  CascadeSubStoreSnapshotUnsafe,
} from "./types";
import { createCascadeLogger } from "./logger";
import {
  castCascadeDependenciesToData,
  getCascadeDependencies,
  getCascadeDependenciesUnsafe,
  resolveCascadeDependencies,
} from "./dependencies";
import { getArgsKey } from "./utils";

export function createCascadeCleanBuilder(): CascadeCleanBuilder {
  const createBaseFlowContext = <T extends CascadeData>(
    context: CascadeFlowInitializerContext<T>,
  ): CascadeBaseFlowContext<T> => {
    return {
      dependencies: {},
      filterFn: () => true,
      initialData: context.initialData,
      substoreKey: context.substoreKey,
      flowKey: context.flowKey,
      logger: createCascadeLogger(`${context.substoreKey}.${context.flowKey}`),
    };
  };

  return {
    withDependencies(dependencies) {
      return createCascadeBuilderWithDependencies(dependencies);
    },
    selector<T extends CascadeData>(handler: () => T | Promise<T>) {
      let flow: CascadeSelector<T>;
      return createCascadeInitializer(
        () => flow!,
        (context) => {
          flow = createCascadeSelectorFlow({
            ...createBaseFlowContext(context),
            handler: context.tracker.wrapExecution(
              async () => handler(),
              context.substoreKey,
              context.flowKey,
            ),
          });
        },
      ) as CascadeSelectorInitializer<T>;
    },
    mutation<T extends CascadeData, A extends CascadeArgs>(
      handler: (args: A) => T | Promise<T>,
    ) {
      let flow: CascadeMutation<T, A>;

      return createCascadeInitializer(
        () => flow!,
        (context) => {
          flow = createCascadeMutationFlow({
            ...createBaseFlowContext(context),
            handler: context.tracker.wrapExecution(
              async (args: A) => handler(args),
              context.substoreKey,
              context.flowKey,
            ),
          });
        },
      ) as CascadeMutationInitializer<T, A>;
    },
    subscription<T extends CascadeData, A extends CascadeArgs>(
      handler: (args: A) => Observable<T>,
    ) {
      let flow: CascadeSubscription<T, A>;

      return createCascadeInitializer(
        () => flow!,
        (context) => {
          flow = createCascadeSubscriptionFlow({
            ...createBaseFlowContext(context),
            handler: context.tracker.wrapExecution(
              handler,
              context.substoreKey,
              context.flowKey,
            ),
          });
        },
      ) as CascadeSubscriptionInitializer<T, A>;
    },
    isolated<T extends CascadeData, A extends CascadeArgs>(
      handler: (args: A) => T | Promise<T>,
    ) {
      let ctx: CascadeFlowInitializerContext<CascadeData>;
      const selectorsMap = new Map<string, CascadeSelector<CascadeData>>();

      return createCascadeInitializer(
        (args: A) => {
          const argsKey = getArgsKey(args);

          if (!selectorsMap.has(argsKey)) {
            const { logger, initialData, ...rest } = createBaseFlowContext(ctx);
            selectorsMap.set(
              argsKey,
              createCascadeSelectorFlow({
                ...rest,
                logger,
                initialData: (initialData as Record<string, CascadeData>)?.[
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
      ) as CascadeIsolatedInitializer<T, A>;
    },
  };
}

export function createCascadeBuilderWithDependencies<D extends CascadeSubStore>(
  dependencies: D,
  filterFns: ((
    dependencies: CascadeSubStoreSnapshotUnsafe<D>,
  ) => boolean)[] = [],
): CascadeBuilderWithDependencies<D> {
  const allDependenciesReady = (
    dependencies: CascadeSubStoreSnapshotUnsafe<D>,
  ) => {
    return Object.values(dependencies).every((dep) => dep.ready && dep.success);
  };

  const createBaseFlowContext = <T extends CascadeData>(
    context: CascadeFlowInitializerContext<T>,
    additionalFilterFn?: (
      dependencies: CascadeSubStoreSnapshotUnsafe<D>,
    ) => boolean,
  ): CascadeBaseFlowContext<T> => {
    const logger = createCascadeLogger(
      `${context.substoreKey}.${context.flowKey}`,
    );
    return {
      dependencies,
      filterFn: () => {
        try {
          const deps = getCascadeDependenciesUnsafe(dependencies);

          return [
            ...filterFns,
            additionalFilterFn ? additionalFilterFn : () => true,
          ].every((fn) => fn(deps));
        } catch (error) {
          logger.error("filterFn error", error);
          return false;
        }
      },
      initialData: context.initialData,
      substoreKey: context.substoreKey,
      flowKey: context.flowKey,
      logger,
    };
  };

  return {
    when(filterFn) {
      return createCascadeBuilderWithDependencies(dependencies, [
        ...filterFns,
        (dependencies) => {
          try {
            return filterFn(castCascadeDependenciesToData(dependencies));
          } catch (error) {
            return false;
          }
        },
      ]);
    },
    whenUnsafe(filterFn) {
      return createCascadeBuilderWithDependencies(dependencies, [
        ...filterFns,
        filterFn,
      ]);
    },
    selector<T extends CascadeData>(
      handler: (dependencies: CascadeSubStoreSnapshot<D>) => T | Promise<T>,
    ) {
      let flow: CascadeSelector<T>;
      return createCascadeInitializer(
        () => flow!,
        (context) => {
          const { logger, ...rest } = createBaseFlowContext(
            context,
            allDependenciesReady,
          );
          flow = createCascadeSelectorFlow({
            ...rest,
            logger,
            handler: async () => {
              const deps = getCascadeDependencies(dependencies);

              logger.debug("dependencies", deps);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(deps);
            },
          });
        },
      ) as CascadeSelectorInitializer<T>;
    },
    selectorUnsafe<T extends CascadeData>(
      handler: (
        dependencies: CascadeSubStoreSnapshotUnsafe<D>,
      ) => T | Promise<T>,
    ) {
      let flow: CascadeSelector<T>;
      return createCascadeInitializer(
        () => flow!,
        (context) => {
          const { logger, ...rest } = createBaseFlowContext(context);
          flow = createCascadeSelectorFlow({
            ...rest,
            logger,
            handler: async () => {
              const deps = getCascadeDependenciesUnsafe(dependencies);

              logger.debug("dependencies", deps);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(deps);
            },
          });
        },
      ) as CascadeSelectorInitializer<T>;
    },
    mutation<T extends CascadeData, A extends CascadeArgs>(
      handler: (
        args: A,
        dependencies: CascadeSubStoreSnapshot<D>,
      ) => T | Promise<T>,
    ) {
      let flow: CascadeMutation<T, A>;

      return createCascadeInitializer(
        () => flow!,
        (context) => {
          const { logger, ...rest } = createBaseFlowContext(
            context,
            allDependenciesReady,
          );
          flow = createCascadeMutationFlow({
            ...rest,
            logger,
            handler: async (args: A) => {
              const deps = getCascadeDependencies(dependencies);

              logger.debug("dependencies", deps);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as CascadeMutationInitializer<T, A>;
    },
    mutationUnsafe<T extends CascadeData, A extends CascadeArgs>(
      handler: (
        args: A,
        dependencies: CascadeSubStoreSnapshotUnsafe<D>,
      ) => T | Promise<T>,
    ) {
      let flow: CascadeMutation<T, A>;

      return createCascadeInitializer(
        () => flow!,
        (context) => {
          const { logger, ...rest } = createBaseFlowContext(context);
          flow = createCascadeMutationFlow({
            ...rest,
            logger,
            handler: async (args: A) => {
              const deps = getCascadeDependenciesUnsafe(dependencies);

              logger.debug("dependencies", deps);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as CascadeMutationInitializer<T, A>;
    },
    subscription<T extends CascadeData, A extends CascadeArgs>(
      handler: (
        args: A,
        dependencies: CascadeSubStoreSnapshot<D>,
      ) => Observable<T>,
    ) {
      let flow: CascadeSubscription<T, A>;

      return createCascadeInitializer(
        () => flow!,
        (context) => {
          const { logger, ...rest } = createBaseFlowContext(
            context,
            allDependenciesReady,
          );
          flow = createCascadeSubscriptionFlow({
            ...rest,
            logger,
            handler: (args: A) => {
              const deps = getCascadeDependencies(dependencies);

              logger.debug("dependencies", deps);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as CascadeSubscriptionInitializer<T, A>;
    },
    subscriptionUnsafe<T extends CascadeData, A extends CascadeArgs>(
      handler: (
        args: A,
        dependencies: CascadeSubStoreSnapshotUnsafe<D>,
      ) => Observable<T>,
    ) {
      let flow: CascadeSubscription<T, A>;

      return createCascadeInitializer(
        () => flow!,
        (context) => {
          const { logger, ...rest } = createBaseFlowContext(
            context,
            allDependenciesReady,
          );
          flow = createCascadeSubscriptionFlow({
            ...rest,
            logger,
            handler: (args: A) => {
              const deps = getCascadeDependenciesUnsafe(dependencies);

              logger.debug("dependencies", deps);

              return context.tracker.wrapExecution(
                handler,
                context.substoreKey,
                context.flowKey,
              )(args, deps);
            },
          });
        },
      ) as CascadeSubscriptionInitializer<T, A>;
    },
    isolated<T extends CascadeData, A extends CascadeArgs>(
      handler: (
        args: A,
        dependencies: CascadeSubStoreSnapshot<D>,
      ) => T | Promise<T>,
    ) {
      let ctx: CascadeFlowInitializerContext<CascadeData>;
      const selectorsMap = new Map<string, CascadeSelector<CascadeData>>();

      return createCascadeInitializer(
        (args: A) => {
          const argsKey = getArgsKey(args);

          if (!selectorsMap.has(argsKey)) {
            const { logger, initialData, ...rest } = createBaseFlowContext(ctx);
            selectorsMap.set(
              argsKey,
              createCascadeSelectorFlow({
                ...rest,
                logger,
                initialData: (initialData as Record<string, CascadeData>)?.[
                  argsKey
                ],
                handler: async () => {
                  await resolveCascadeDependencies(dependencies);

                  const deps = getCascadeDependencies(dependencies);

                  logger.debug("dependencies", deps);

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
      ) as CascadeIsolatedInitializer<T, A>;
    },
    isolatedUnsafe<T extends CascadeData, A extends CascadeArgs>(
      handler: (
        args: A,
        dependencies: CascadeSubStoreSnapshotUnsafe<D>,
      ) => T | Promise<T>,
    ) {
      let ctx: CascadeFlowInitializerContext<CascadeData>;
      const selectorsMap = new Map<string, CascadeSelector<CascadeData>>();

      return createCascadeInitializer(
        (args: A) => {
          const argsKey = getArgsKey(args);

          if (!selectorsMap.has(argsKey)) {
            const { logger, initialData, ...rest } = createBaseFlowContext(ctx);
            selectorsMap.set(
              argsKey,
              createCascadeSelectorFlow({
                ...rest,
                logger,
                initialData: (initialData as Record<string, CascadeData>)?.[
                  argsKey
                ],
                handler: async () => {
                  const deps = getCascadeDependenciesUnsafe(dependencies);

                  logger.debug("dependencies", deps);

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
      ) as CascadeIsolatedInitializer<T, A>;
    },
  };
}
