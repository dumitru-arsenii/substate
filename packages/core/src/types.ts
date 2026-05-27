import type { Observable } from "rxjs";

export type CascadeData = Record<string, unknown> | Record<string, unknown>[];
export type CascadeArgs = Record<string, unknown>;
export type CascadeSuccessResult<T extends CascadeData> = {
  ready: true;
  success: true;
  data: T;
};
export type CascadeFailureResult = {
  ready: true;
  success: false;
  error: unknown;
};
export type CascadeNonReadyResult = {
  ready: false;
};
export type CascadeResult<T extends CascadeData> =
  | CascadeSuccessResult<T>
  | CascadeFailureResult
  | CascadeNonReadyResult;

export type CascadeBaseFlow<T extends CascadeData> = {
  latest(): CascadeResult<T>;
  data(): Observable<T>;
  stream(): Observable<CascadeResult<T>>;
};
export type CascadeBaseFlowContext<T extends CascadeData> = {
  substoreKey: string;
  flowKey: string;
  dependencies: CascadeSubStore;
  initialData?: T | undefined;
  filterFn: () => boolean;
  logger: CascadeLogger;
};

export type CascadeSelector<T extends CascadeData> = CascadeBaseFlow<T> & {
  resolve(): Promise<T>;
};
export type CascadeSelectorContext<T extends CascadeData> =
  CascadeBaseFlowContext<T> & {
    handler(): Promise<T> | T;
  };
export type CascadeMutation<
  T extends CascadeData,
  A extends CascadeArgs,
> = CascadeBaseFlow<T> & {
  run(args: A): Promise<T>;
};
export type CascadeMutationContext<
  T extends CascadeData,
  A extends CascadeArgs,
> = CascadeBaseFlowContext<T> & {
  handler(args: A): Promise<T> | T;
};
export type CascadeSubscription<
  T extends CascadeData,
  A extends CascadeArgs,
> = CascadeBaseFlow<T> & {
  watch(args: A): Observable<T>;
};
export type CascadeSubscriptionContext<
  T extends CascadeData,
  A extends CascadeArgs,
> = CascadeBaseFlowContext<T> & {
  handler(args: A): Observable<T>;
};
export type CascacdeFlow<T extends CascadeData> =
  | CascadeSelector<T>
  | CascadeMutation<T, any>
  | CascadeSubscription<T, any>;
export type CascadeFlowData<F extends CascacdeFlow<any>> =
  F extends CascadeSelector<infer T>
    ? T
    : F extends CascadeMutation<infer T, any>
      ? T
      : F extends CascadeSubscription<infer T, any>
        ? T
        : never;

export type CascadeTracker = {
  wrapExecution<Fn extends (...args: any[]) => any>(
    fn: Fn,
    substoreKey: string,
    flowKey: string,
    argsKey?: string,
  ): Fn;
  whenIdle(): Promise<void>;
  isPending(): boolean;
  getSnapshot(): Partial<Record<string, Partial<Record<string, CascadeData>>>>;
};

export type CascadeFlowInitializerContext<T extends CascadeData> = {
  substoreKey: string;
  flowKey: string;
  tracker: CascadeTracker;
  initialData?: T | undefined;
};
export type CascadeFlowBaseInitializers<T extends CascadeData> = {
  isInitialized(): boolean;
  initialize(context: CascadeFlowInitializerContext<T>): void;
};
export type CascadeSelectorInitializer<T extends CascadeData> =
  CascadeFlowBaseInitializers<T> & {
    (): CascadeSelector<T>;
  };
export type CascadeMutationInitializer<
  T extends CascadeData,
  A extends CascadeArgs,
> = CascadeFlowBaseInitializers<T> & {
  (): CascadeMutation<T, A>;
};
export type CascadeSubscriptionInitializer<
  T extends CascadeData,
  A extends CascadeArgs,
> = CascadeFlowBaseInitializers<T> & {
  (): CascadeSubscription<T, A>;
};
export type CascadeIsolatedInitializer<
  T extends CascadeData,
  A extends CascadeArgs,
> = CascadeFlowBaseInitializers<T> & {
  (args: A): CascadeSelector<T>;
};
export type CascadeFlowInitializer<T extends CascadeData> =
  | CascadeSelectorInitializer<T>
  | CascadeMutationInitializer<T, any>
  | CascadeSubscriptionInitializer<T, any>
  | CascadeIsolatedInitializer<T, any>;

export type CascadeCleanBuilder = {
  withDependencies<D extends CascadeSubStore>(
    dependencies: D,
  ): CascadeBuilderWithDependencies<D>;
  selector<T extends CascadeData>(
    handler: () => Promise<T> | T,
  ): CascadeSelectorInitializer<T>;
  mutation<T extends CascadeData, A extends CascadeArgs>(
    handler: (args: A) => Promise<T> | T,
  ): CascadeMutationInitializer<T, A>;
  subscription<T extends CascadeData, A extends CascadeArgs>(
    handler: (args: A) => Observable<T>,
  ): CascadeSubscriptionInitializer<T, A>;
  isolated<T extends CascadeData, A extends CascadeArgs>(
    handler: (args: A) => Promise<T> | T,
  ): CascadeIsolatedInitializer<T, A>;
};
export type CascadeBuilderWithDependencies<D extends CascadeSubStore> = {
  selector<T extends CascadeData>(
    handler: (dependencies: CascadeSubStoreSnapshot<D>) => Promise<T> | T,
  ): CascadeSelectorInitializer<T>;
  selectorUnsafe<T extends CascadeData>(
    handler: (dependencies: CascadeSubStoreSnapshotUnsafe<D>) => Promise<T> | T,
  ): CascadeSelectorInitializer<T>;
  mutation<T extends CascadeData, A extends CascadeArgs>(
    handler: (
      args: A,
      dependencies: CascadeSubStoreSnapshot<D>,
    ) => Promise<T> | T,
  ): CascadeMutationInitializer<T, A>;
  mutationUnsafe<T extends CascadeData, A extends CascadeArgs>(
    handler: (
      args: A,
      dependencies: CascadeSubStoreSnapshotUnsafe<D>,
    ) => Promise<T> | T,
  ): CascadeMutationInitializer<T, A>;
  subscription<T extends CascadeData, A extends CascadeArgs>(
    handler: (
      args: A,
      dependencies: CascadeSubStoreSnapshot<D>,
    ) => Observable<T>,
  ): CascadeSubscriptionInitializer<T, A>;
  subscriptionUnsafe<T extends CascadeData, A extends CascadeArgs>(
    handler: (
      args: A,
      dependencies: CascadeSubStoreSnapshotUnsafe<D>,
    ) => Observable<T>,
  ): CascadeSubscriptionInitializer<T, A>;
  isolated<T extends CascadeData, A extends CascadeArgs>(
    handler: (
      args: A,
      dependencies: CascadeSubStoreSnapshot<D>,
    ) => Promise<T> | T,
  ): CascadeIsolatedInitializer<T, A>;
  isolatedUnsafe<T extends CascadeData, A extends CascadeArgs>(
    handler: (
      args: A,
      dependencies: CascadeSubStoreSnapshotUnsafe<D>,
    ) => Promise<T> | T,
  ): CascadeIsolatedInitializer<T, A>;
  when(
    filterFn: (dependencies: CascadeSubStoreSnapshot<D>) => boolean,
  ): CascadeBuilderWithDependencies<D>;
  whenUnsafe(
    filterFn: (dependencies: CascadeSubStoreSnapshotUnsafe<D>) => boolean,
  ): CascadeBuilderWithDependencies<D>;
};

export type CascadeSubStore = Record<string, CascadeFlowInitializer<any>>;
export type CascadeSubStoreSnapshot<S extends CascadeSubStore> = {
  [K in keyof S]: S[K] extends CascadeSelectorInitializer<infer U>
    ? U
    : S[K] extends CascadeMutationInitializer<infer U, any>
      ? U
      : S[K] extends CascadeSubscriptionInitializer<infer U, any>
        ? U
        : S[K] extends CascadeIsolatedInitializer<infer U, any>
          ? Record<string, U>
          : never;
};
export type CascadeSubStoreSnapshotUnsafe<S extends CascadeSubStore> = {
  [K in keyof S]: S[K] extends CascadeFlowInitializer<infer T>
    ? CascadeResult<T>
    : never;
};
export type CascadeSubStoreInitializerContext = {
  substoreKey: string;
  tracker: CascadeTracker;
  initialData?: Record<string, CascadeData> | undefined;
};
export type CascadeSubStoreInitializer<S extends CascadeSubStore> = {
  (): S;
  isInitialized(): boolean;
  initialize(context: CascadeSubStoreInitializerContext): void;
  uuid(): string;
  getDependenciesUuids(): string[];
};

export type CascadeStoreSubStoresInitializers = Record<
  string,
  CascadeSubStoreInitializer<any>
>;
export type CascadeSubStoreFlowInitializers<
  S extends CascadeStoreSubStoresInitializers,
> = {
  [K in keyof S]: S[K] extends CascadeSubStoreInitializer<infer T> ? T : never;
};
export type CascadeStoreSubStores<S extends CascadeStoreSubStoresInitializers> =
  {
    [K in keyof S]: S[K] extends CascadeSubStoreInitializer<infer T>
      ? T
      : never;
  };

export type CascadeStoreSnapshot<S extends CascadeStoreSubStoresInitializers> =
  {
    [K in keyof S]?: S[K] extends CascadeSubStoreInitializer<infer T>
      ? Partial<CascadeSubStoreSnapshot<T>>
      : never;
  };
export type CascadeStore<S extends CascadeStoreSubStoresInitializers> =
  CascadeStoreSubStores<S> & {
    isPending(): boolean;
    whenIdle(): Promise<void>;
    getSnapshot(): CascadeStoreSnapshot<S>;
    setLogLevel(level: CascadeLogLevel): void;
  };

export type CascadeLogLevel = "debug" | "info" | "warn" | "error";
export type CascadeLogger = Record<
  CascadeLogLevel,
  (message: string, ctx?: unknown) => void
>;
