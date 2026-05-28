import type {
  SubstateArgs,
  SubstateData,
  SubstateMutation,
  SubstateResult,
  SubstateSelector,
  SubstateSubscription,
} from "@substate/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState as useReactState,
  type ReactNode,
} from "react";

export type SubstateFlow<
  TData extends SubstateData,
  TArgs extends SubstateArgs = SubstateArgs,
> =
  | SubstateSelector<TData>
  | SubstateMutation<TData, TArgs>
  | SubstateSubscription<TData, TArgs>;

export type SubstateFlowData<TFlow> =
  TFlow extends SubstateSelector<infer TData>
    ? TData
    : TFlow extends SubstateMutation<infer TData, SubstateArgs>
      ? TData
      : TFlow extends SubstateSubscription<infer TData, SubstateArgs>
        ? TData
        : never;

export type SubstateFlowFetch<TFlow> =
  TFlow extends SubstateSelector<infer TData>
    ? () => Promise<TData>
    : TFlow extends SubstateMutation<infer TData, infer TArgs>
      ? (args: TArgs) => Promise<TData>
      : TFlow extends SubstateSubscription<infer TData, infer TArgs>
        ? (args: TArgs) => Promise<TData>
        : never;

export type SubstateHookStatus = {
  ready: boolean;
  fetching: boolean;
  success: boolean;
  error: unknown | undefined;
};

export type SubstateHookState<TData extends SubstateData> = {
  data: TData | undefined;
  status: SubstateHookStatus;
};

export type SubstateHookResult<TFlow> = [
  data: SubstateFlowData<TFlow> | undefined,
  fetch: SubstateFlowFetch<TFlow>,
  status: SubstateHookStatus,
];

export type SubstateFlowSelector<TStore, TFlow> = (store: TStore) => TFlow;

export type SubstateReactProviderProps<TStore> = {
  store: TStore;
  children: ReactNode;
};

type StreamSubscription = {
  unsubscribe(): void;
};

type SubstateDataStream<TData extends SubstateData> = {
  subscribe(observer: {
    next(data: TData): void;
    error(error: unknown): void;
  }): StreamSubscription;
};

type SubstateResultStream<TData extends SubstateData> = {
  subscribe(next: (result: SubstateResult<TData>) => void): StreamSubscription;
};

const idleStatus: SubstateHookStatus = {
  ready: false,
  fetching: false,
  success: false,
  error: undefined,
};

function getSnapshot<TData extends SubstateData>(
  result: SubstateResult<TData>,
): SubstateHookState<TData> {
  if (!result.ready) {
    return {
      data: undefined,
      status: idleStatus,
    };
  }

  if (result.success) {
    return {
      data: result.data,
      status: {
        ready: true,
        fetching: false,
        success: true,
        error: undefined,
      },
    };
  }

  return {
    data: undefined,
    status: {
      ready: true,
      fetching: false,
      success: false,
      error: result.error,
    },
  };
}

function fetchFlow<TData extends SubstateData, TArgs extends SubstateArgs>(
  flow: SubstateFlow<TData, TArgs>,
  args: TArgs | undefined,
): Promise<TData> {
  if ("resolve" in flow) {
    return flow.resolve();
  }

  if ("run" in flow) {
    return flow.run(args as TArgs);
  }

  return new Promise<TData>((resolve, reject) => {
    const subscriptionRef: { current: StreamSubscription | undefined } = {
      current: undefined,
    };
    let shouldUnsubscribe = false;
    const unsubscribe = () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      } else {
        shouldUnsubscribe = true;
      }
    };

    const subscription = (
      flow.watch(args as TArgs) as SubstateDataStream<TData>
    ).subscribe({
      next(data) {
        resolve(data);
        unsubscribe();
      },
      error(error) {
        reject(error);
        unsubscribe();
      },
    });
    subscriptionRef.current = subscription;

    if (shouldUnsubscribe) {
      subscription.unsubscribe();
    }
  });
}

export function createSubstateReact<TStore>() {
  const StoreContext = createContext<TStore | null>(null);

  function Provider({ store, children }: SubstateReactProviderProps<TStore>) {
    return (
      <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
    );
  }

  function useState<TData extends SubstateData>(
    selector: SubstateFlowSelector<TStore, SubstateSelector<TData>>,
  ): SubstateHookResult<SubstateSelector<TData>>;
  function useState<TData extends SubstateData, TArgs extends SubstateArgs>(
    selector: SubstateFlowSelector<TStore, SubstateMutation<TData, TArgs>>,
  ): SubstateHookResult<SubstateMutation<TData, TArgs>>;
  function useState<TData extends SubstateData, TArgs extends SubstateArgs>(
    selector: SubstateFlowSelector<TStore, SubstateSubscription<TData, TArgs>>,
  ): SubstateHookResult<SubstateSubscription<TData, TArgs>>;
  function useState<TFlow extends SubstateFlow<SubstateData, SubstateArgs>>(
    selector: SubstateFlowSelector<TStore, TFlow>,
  ): SubstateHookResult<TFlow> {
    const store = useContext(StoreContext);

    if (!store) {
      throw new Error("Substate Provider is missing");
    }

    const flow = selector(store);
    const initial = getSnapshot(flow.latest());
    const [data, setData] = useReactState<SubstateFlowData<TFlow> | undefined>(
      initial.data as SubstateFlowData<TFlow> | undefined,
    );
    const [status, setStatus] = useReactState<SubstateHookStatus>(
      initial.status,
    );

    useEffect(() => {
      const applyResult = (result: SubstateResult<SubstateFlowData<TFlow>>) => {
        const next = getSnapshot(result);

        setData(next.data);
        setStatus((current) => ({
          ...next.status,
          fetching: current.fetching,
        }));
      };

      applyResult(flow.latest() as SubstateResult<SubstateFlowData<TFlow>>);

      const stream = flow.stream() as SubstateResultStream<
        SubstateFlowData<TFlow>
      >;
      const subscription = stream.subscribe(applyResult);

      return () => {
        subscription.unsubscribe();
      };
    }, [flow]);

    const fetch = useCallback(
      async (args?: SubstateArgs) => {
        setStatus((current) => ({
          ...current,
          fetching: true,
        }));

        try {
          const result = await fetchFlow(
            flow as SubstateFlow<SubstateFlowData<TFlow>, SubstateArgs>,
            args,
          );

          setData(result);
          setStatus({
            ready: true,
            fetching: false,
            success: true,
            error: undefined,
          });

          return result;
        } catch (error) {
          setStatus({
            ready: true,
            fetching: false,
            success: false,
            error,
          });

          throw error;
        }
      },
      [flow],
    ) as unknown as SubstateFlowFetch<TFlow>;

    return [data, fetch, status];
  }

  return {
    Provider,
    useState,
  };
}

export const createSubstateHooks = createSubstateReact;
