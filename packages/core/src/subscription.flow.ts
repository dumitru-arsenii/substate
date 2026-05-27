import { BehaviorSubject, tap } from "rxjs";
import type { Subscription } from "rxjs";
import {
  makeCascadeFailureResult,
  makeCascadeNonReadyResult,
  makeCascadeSuccessResult,
} from "./result";
import type {
  CascadeArgs,
  CascadeData,
  CascadeResult,
  CascadeSubscription,
  CascadeSubscriptionContext,
} from "./types";
import { filterCascadeSuccessAndMapToData } from "./utils";

export function createCascadeSubscriptionFlow<
  T extends CascadeData,
  A extends CascadeArgs,
>(context: CascadeSubscriptionContext<T, A>): CascadeSubscription<T, A> {
  const state = new BehaviorSubject<CascadeResult<T>>(
    context.initialData
      ? makeCascadeSuccessResult(context.initialData)
      : makeCascadeNonReadyResult(),
  );
  let subscription: Subscription | undefined;
  const onError = (error: unknown) => {
    if (subscription) {
      context.logger.debug("unsubscribe on error", error);
      subscription.unsubscribe();
    }

    state.next(makeCascadeFailureResult(error));
  };

  const resolve = async (args: A) => {
    context.logger.debug("resolve started");
    try {
      const canResolve = context.filterFn();

      context.logger.debug("can resolve", canResolve);

      if (subscription) {
        context.logger.debug("unsubscribe");
        subscription.unsubscribe();
      }

      if (canResolve) {
        const stream = context.handler(args);
        context.logger.debug("resolve success");

        subscription = stream.subscribe({
          next(data) {
            context.logger.debug("stream data", data);
            state.next(makeCascadeSuccessResult(data));
          },
          error(error) {
            context.logger.error("stream error", error);
            onError(error);
          },
        });
        context.logger.debug("resolve done");
      }
    } catch (error) {
      context.logger.error("resolve error", error);
      onError(error);

      throw error;
    }
  };

  return {
    watch(args: A) {
      context.logger.debug("watch triggered with args", args);
      void resolve(args).catch((error) => {
        context.logger.debug(
          "watch resolve rejected (state already updated)",
          error,
        );
      });
      return filterCascadeSuccessAndMapToData(state.asObservable());
    },
    latest() {
      context.logger.debug("latest accessed");
      return state.getValue();
    },
    data() {
      context.logger.debug("data accessed");
      return filterCascadeSuccessAndMapToData(state.asObservable()).pipe(
        tap((data) => {
          context.logger.debug("data", data);
        }),
      );
    },
    stream() {
      context.logger.debug("stream accessed");
      return state.asObservable().pipe(
        tap((data) => {
          context.logger.debug("result", data);
        }),
      );
    },
  };
}
