import { BehaviorSubject, tap } from "rxjs";
import {
  makeCascadeFailureResult,
  makeCascadeNonReadyResult,
  makeCascadeSuccessResult,
} from "./result";
import type {
  CascadeArgs,
  CascadeData,
  CascadeMutation,
  CascadeMutationContext,
  CascadeResult,
} from "./types";
import {
  filterCascadeSuccessAndMapToData,
  takeFirstCascadeSuccessData,
} from "./utils";

export function createCascadeMutationFlow<
  T extends CascadeData,
  A extends CascadeArgs,
>(context: CascadeMutationContext<T, A>): CascadeMutation<T, A> {
  const state = new BehaviorSubject<CascadeResult<T>>(
    context.initialData
      ? makeCascadeSuccessResult(context.initialData)
      : makeCascadeNonReadyResult(),
  );

  const resolve = async (args: A) => {
    context.logger.debug("resolve started");
    try {
      const canResolve = context.filterFn();

      context.logger.debug("can resolve", canResolve);

      if (canResolve) {
        const data = await context.handler(args);
        context.logger.debug("resolve success", data);
        state.next(makeCascadeSuccessResult(data));
        context.logger.debug("resolve done");
      }
    } catch (error) {
      context.logger.error("resolve error", error);
      state.next(makeCascadeFailureResult(error));

      throw error;
    }
  };

  return {
    async run(args: A) {
      context.logger.debug("run triggered with args", args);

      await resolve(args);

      return takeFirstCascadeSuccessData(state.asObservable());
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
