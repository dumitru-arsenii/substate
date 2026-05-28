import type { Observable } from "rxjs";

export type SubstateData = Record<string, unknown> | Record<string, unknown>[];
export type SubstateArgs = Record<string, unknown>;
export type SubstateSuccessResult<T extends SubstateData> = {
  ready: true;
  success: true;
  data: T;
};
export type SubstateFailureResult = {
  ready: true;
  success: false;
  error: unknown;
};
export type SubstateNonReadyResult = {
  ready: false;
};
export type SubstateResult<T extends SubstateData> =
  | SubstateSuccessResult<T>
  | SubstateFailureResult
  | SubstateNonReadyResult;

export type SubstateBaseFlow<T extends SubstateData> = {
  latest(): SubstateResult<T>;
  data(): Observable<T>;
  stream(): Observable<SubstateResult<T>>;
};
export type SubstateBaseFlowContext<T extends SubstateData> = {
  substoreKey: string;
  flowKey: string;
  dependencies: SubstateSubStore;
  initialData?: T | undefined;
  filterFn: () => boolean;
};

export type SubstateSelector<T extends SubstateData> = SubstateBaseFlow<T> & {
  resolve(): Promise<T>;
};
export type SubstateSelectorContext<T extends SubstateData> =
  SubstateBaseFlowContext<T> & {
    handler(): Promise<T> | T;
  };
export type SubstateMutation<
  T extends SubstateData,
  A extends SubstateArgs,
> = SubstateBaseFlow<T> & {
  run(args: A): Promise<T>;
};
export type SubstateMutationContext<
  T extends SubstateData,
  A extends SubstateArgs,
> = SubstateBaseFlowContext<T> & {
  handler(args: A): Promise<T> | T;
};
export type SubstateSubscription<
  T extends SubstateData,
  A extends SubstateArgs,
> = SubstateBaseFlow<T> & {
  watch(args: A): Observable<T>;
};
export type SubstateSubscriptionContext<
  T extends SubstateData,
  A extends SubstateArgs,
> = SubstateBaseFlowContext<T> & {
  handler(args: A): Observable<T>;
};
export type SubstateFlow<T extends SubstateData> =
  | SubstateSelector<T>
  | SubstateMutation<T, any>
  | SubstateSubscription<T, any>;
export type SubstateFlowData<F extends SubstateFlow<any>> =
  F extends SubstateSelector<infer T>
    ? T
    : F extends SubstateMutation<infer T, any>
      ? T
      : F extends SubstateSubscription<infer T, any>
        ? T
        : never;

export type SubstateTracker = {
  wrapExecution<Fn extends (...args: any[]) => any>(
    fn: Fn,
    substoreKey: string,
    flowKey: string,
    argsKey?: string,
  ): Fn;
  whenIdle(): Promise<void>;
  isPending(): boolean;
  getSnapshot(): Partial<Record<string, Partial<Record<string, SubstateData>>>>;
};

export type SubstateFlowInitializerContext<T extends SubstateData> = {
  substoreKey: string;
  flowKey: string;
  tracker: SubstateTracker;
  initialData?: T | undefined;
};
export type SubstateFlowBaseInitializers<T extends SubstateData> = {
  isInitialized(): boolean;
  initialize(context: SubstateFlowInitializerContext<T>): void;
};
export type SubstateSelectorInitializer<T extends SubstateData> =
  SubstateFlowBaseInitializers<T> & {
    (): SubstateSelector<T>;
  };
export type SubstateMutationInitializer<
  T extends SubstateData,
  A extends SubstateArgs,
> = SubstateFlowBaseInitializers<T> & {
  (): SubstateMutation<T, A>;
};
export type SubstateSubscriptionInitializer<
  T extends SubstateData,
  A extends SubstateArgs,
> = SubstateFlowBaseInitializers<T> & {
  (): SubstateSubscription<T, A>;
};
export type SubstateIsolatedInitializer<
  T extends SubstateData,
  A extends SubstateArgs,
> = SubstateFlowBaseInitializers<T> & {
  (args: A): SubstateSelector<T>;
};
export type SubstateFlowInitializer<T extends SubstateData> =
  | SubstateSelectorInitializer<T>
  | SubstateMutationInitializer<T, any>
  | SubstateSubscriptionInitializer<T, any>
  | SubstateIsolatedInitializer<T, any>;

export type SubstateCleanBuilder = {
  withDependencies<D extends SubstateSubStore>(
    dependencies: D,
  ): SubstateBuilderWithDependencies<D>;
  selector<T extends SubstateData>(
    handler: () => Promise<T> | T,
  ): SubstateSelectorInitializer<T>;
  mutation<T extends SubstateData, A extends SubstateArgs>(
    handler: (args: A) => Promise<T> | T,
  ): SubstateMutationInitializer<T, A>;
  subscription<T extends SubstateData, A extends SubstateArgs>(
    handler: (args: A) => Observable<T>,
  ): SubstateSubscriptionInitializer<T, A>;
  isolated<T extends SubstateData, A extends SubstateArgs>(
    handler: (args: A) => Promise<T> | T,
  ): SubstateIsolatedInitializer<T, A>;
};
export type SubstateBuilderWithDependencies<D extends SubstateSubStore> = {
  selector<T extends SubstateData>(
    handler: (dependencies: SubstateSubStoreSnapshot<D>) => Promise<T> | T,
  ): SubstateSelectorInitializer<T>;
  selectorUnsafe<T extends SubstateData>(
    handler: (
      dependencies: SubstateSubStoreSnapshotUnsafe<D>,
    ) => Promise<T> | T,
  ): SubstateSelectorInitializer<T>;
  mutation<T extends SubstateData, A extends SubstateArgs>(
    handler: (
      args: A,
      dependencies: SubstateSubStoreSnapshot<D>,
    ) => Promise<T> | T,
  ): SubstateMutationInitializer<T, A>;
  mutationUnsafe<T extends SubstateData, A extends SubstateArgs>(
    handler: (
      args: A,
      dependencies: SubstateSubStoreSnapshotUnsafe<D>,
    ) => Promise<T> | T,
  ): SubstateMutationInitializer<T, A>;
  subscription<T extends SubstateData, A extends SubstateArgs>(
    handler: (
      args: A,
      dependencies: SubstateSubStoreSnapshot<D>,
    ) => Observable<T>,
  ): SubstateSubscriptionInitializer<T, A>;
  subscriptionUnsafe<T extends SubstateData, A extends SubstateArgs>(
    handler: (
      args: A,
      dependencies: SubstateSubStoreSnapshotUnsafe<D>,
    ) => Observable<T>,
  ): SubstateSubscriptionInitializer<T, A>;
  isolated<T extends SubstateData, A extends SubstateArgs>(
    handler: (
      args: A,
      dependencies: SubstateSubStoreSnapshot<D>,
    ) => Promise<T> | T,
  ): SubstateIsolatedInitializer<T, A>;
  isolatedUnsafe<T extends SubstateData, A extends SubstateArgs>(
    handler: (
      args: A,
      dependencies: SubstateSubStoreSnapshotUnsafe<D>,
    ) => Promise<T> | T,
  ): SubstateIsolatedInitializer<T, A>;
  when(
    filterFn: (dependencies: SubstateSubStoreSnapshot<D>) => boolean,
  ): SubstateBuilderWithDependencies<D>;
  whenUnsafe(
    filterFn: (dependencies: SubstateSubStoreSnapshotUnsafe<D>) => boolean,
  ): SubstateBuilderWithDependencies<D>;
};

export type SubstateSubStore = Record<string, SubstateFlowInitializer<any>>;
export type SubstateSubStoreSnapshot<S extends SubstateSubStore> = {
  [K in keyof S]: S[K] extends SubstateSelectorInitializer<infer U>
    ? U
    : S[K] extends SubstateMutationInitializer<infer U, any>
      ? U
      : S[K] extends SubstateSubscriptionInitializer<infer U, any>
        ? U
        : S[K] extends SubstateIsolatedInitializer<infer U, any>
          ? Record<string, U>
          : never;
};
export type SubstateSubStoreSnapshotUnsafe<S extends SubstateSubStore> = {
  [K in keyof S]: S[K] extends SubstateFlowInitializer<infer T>
    ? SubstateResult<T>
    : never;
};
export type SubstateSubStoreInitializerContext = {
  substoreKey: string;
  tracker: SubstateTracker;
  initialData?: Record<string, SubstateData> | undefined;
};
export type SubstateSubStoreInitializer<S extends SubstateSubStore> = {
  (): S;
  isInitialized(): boolean;
  initialize(context: SubstateSubStoreInitializerContext): void;
  uuid(): string;
  getDependenciesUuids(): string[];
};

export type SubstateStoreSubStoresInitializers = Record<
  string,
  SubstateSubStoreInitializer<any>
>;
export type SubstateSubStoreFlowInitializers<
  S extends SubstateStoreSubStoresInitializers,
> = {
  [K in keyof S]: S[K] extends SubstateSubStoreInitializer<infer T> ? T : never;
};
export type SubstateStoreSubStores<
  S extends SubstateStoreSubStoresInitializers,
> = {
  [K in keyof S]: S[K] extends SubstateSubStoreInitializer<infer T> ? T : never;
};

export type SubstateStoreSnapshot<
  S extends SubstateStoreSubStoresInitializers,
> = {
  [K in keyof S]?: S[K] extends SubstateSubStoreInitializer<infer T>
    ? Partial<SubstateSubStoreSnapshot<T>>
    : never;
};
export type SubstateStore<S extends SubstateStoreSubStoresInitializers> =
  SubstateStoreSubStores<S> & {
    isPending(): boolean;
    whenIdle(): Promise<void>;
    getSnapshot(): SubstateStoreSnapshot<S>;
  };
