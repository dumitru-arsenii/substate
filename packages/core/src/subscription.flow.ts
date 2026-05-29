import { BehaviorSubject } from "rxjs";
import type { Subscription } from "rxjs";
import {
  makeSubstateFailureResult,
  makeSubstateNonReadyResult,
  makeSubstateSuccessResult,
} from "./result";
import type {
  SubstateArgs,
  SubstateData,
  SubstateResult,
  SubstateSubscription,
  SubstateSubscriptionContext,
} from "./types";
import {
  filterSubstateSuccessAndMapToData,
  getSubstateSuccessDataOrThrow,
} from "./utils";

export function createSubstateSubscriptionFlow<
  T extends SubstateData,
  A extends SubstateArgs,
>(context: SubstateSubscriptionContext<T, A>): SubstateSubscription<T, A> {
  const state = new BehaviorSubject<SubstateResult<T>>(
    context.initialData
      ? makeSubstateSuccessResult(context.initialData)
      : makeSubstateNonReadyResult(),
  );
  let subscription: Subscription | undefined;
  const onError = (error: unknown) => {
    if (subscription) {
      subscription.unsubscribe();
    }

    state.next(makeSubstateFailureResult(error));
  };

  const resolve = async (args: A) => {
    try {
      const canResolve = context.filterFn();

      if (subscription) {
        subscription.unsubscribe();
      }

      if (canResolve) {
        const stream = context.handler(args);

        subscription = stream.subscribe({
          next(data) {
            state.next(makeSubstateSuccessResult(data));
          },
          error(error) {
            onError(error);
          },
        });
      }
    } catch (error) {
      onError(error);

      throw error;
    }
  };

  return {
    watch(args: A) {
      void resolve(args).catch(() => {});
      return filterSubstateSuccessAndMapToData(state.asObservable());
    },
    latest() {
      return state.getValue();
    },
    value() {
      return getSubstateSuccessDataOrThrow(state.getValue());
    },
    data() {
      return filterSubstateSuccessAndMapToData(state.asObservable());
    },
    stream() {
      return state.asObservable();
    },
  };
}
