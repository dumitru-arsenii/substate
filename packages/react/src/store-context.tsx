import type {
  CascadeArgs,
  CascadeData,
  CascadeMutation,
  CascadeResult,
  CascadeSelector,
  CascadeSubscription,
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
  TData extends CascadeData,
  TArgs extends CascadeArgs = CascadeArgs,
> =
  | CascadeSelector<TData>
  | CascadeMutation<TData, TArgs>
  | CascadeSubscription<TData, TArgs>;

export type SubstateFlowData<TFlow> =
  TFlow extends CascadeSelector<infer TData>
    ? TData
    : TFlow extends CascadeMutation<infer TData, CascadeArgs>
      ? TData
      : TFlow extends CascadeSubscription<infer TData, CascadeArgs>
        ? TData
        : never;

export type SubstateFlowFetch<TFlow> =
  TFlow extends CascadeSelector<infer TData>
    ? () => Promise<TData>
    : TFlow extends CascadeMutation<infer TData, infer TArgs>
      ? (args: TArgs) => Promise<TData>
      : TFlow extends CascadeSubscription<infer TData, infer TArgs>
        ? (args: TArgs) => Promise<TData>
        : never;

export type SubstateHookStatus = {
  ready: boolean;
  fetching: boolean;
  success: boolean;
  error: unknown | undefined;
};

export type SubstateHookState<TData extends CascadeData> = {
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

type SubstateSubscription = {
  unsubscribe(): void;
};

type SubstateDataStream<TData extends CascadeData> = {
  subscribe(observer: {
    next(data: TData): void;
    error(error: unknown): void;
  }): SubstateSubscription;
};

type SubstateResultStream<TData extends CascadeData> = {
  subscribe(next: (result: CascadeResult<TData>) => void): SubstateSubscription;
};

const idleStatus: SubstateHookStatus = {
  ready: false,
  fetching: false,
  success: false,
  error: undefined,
};

function getSnapshot<TData extends CascadeData>(
  result: CascadeResult<TData>,
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

function fetchFlow<TData extends CascadeData, TArgs extends CascadeArgs>(
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
    const subscriptionRef: { current: SubstateSubscription | undefined } = {
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

  function useState<TData extends CascadeData>(
    selector: SubstateFlowSelector<TStore, CascadeSelector<TData>>,
  ): SubstateHookResult<CascadeSelector<TData>>;
  function useState<TData extends CascadeData, TArgs extends CascadeArgs>(
    selector: SubstateFlowSelector<TStore, CascadeMutation<TData, TArgs>>,
  ): SubstateHookResult<CascadeMutation<TData, TArgs>>;
  function useState<TData extends CascadeData, TArgs extends CascadeArgs>(
    selector: SubstateFlowSelector<TStore, CascadeSubscription<TData, TArgs>>,
  ): SubstateHookResult<CascadeSubscription<TData, TArgs>>;
  function useState<TFlow extends SubstateFlow<CascadeData, CascadeArgs>>(
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
      const applyResult = (result: CascadeResult<SubstateFlowData<TFlow>>) => {
        const next = getSnapshot(result);

        setData(next.data);
        setStatus((current) => ({
          ...next.status,
          fetching: current.fetching,
        }));
      };

      applyResult(flow.latest() as CascadeResult<SubstateFlowData<TFlow>>);

      const stream = flow.stream() as SubstateResultStream<
        SubstateFlowData<TFlow>
      >;
      const subscription = stream.subscribe(applyResult);

      return () => {
        subscription.unsubscribe();
      };
    }, [flow]);

    const fetch = useCallback(
      async (args?: CascadeArgs) => {
        setStatus((current) => ({
          ...current,
          fetching: true,
        }));

        try {
          const result = await fetchFlow(
            flow as SubstateFlow<SubstateFlowData<TFlow>, CascadeArgs>,
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
