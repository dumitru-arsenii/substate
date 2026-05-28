import { BehaviorSubject } from "rxjs";
import {
  makeSubstateFailureResult,
  makeSubstateNonReadyResult,
  makeSubstateSuccessResult,
} from "./result";
import type {
  SubstateArgs,
  SubstateData,
  SubstateMutation,
  SubstateMutationContext,
  SubstateResult,
} from "./types";
import {
  filterSubstateSuccessAndMapToData,
  takeFirstSubstateSuccessData,
} from "./utils";

export function createSubstateMutationFlow<
  T extends SubstateData,
  A extends SubstateArgs,
>(context: SubstateMutationContext<T, A>): SubstateMutation<T, A> {
  const state = new BehaviorSubject<SubstateResult<T>>(
    context.initialData
      ? makeSubstateSuccessResult(context.initialData)
      : makeSubstateNonReadyResult(),
  );

  const resolve = async (args: A) => {
    try {
      const canResolve = context.filterFn();

      if (canResolve) {
        const data = await context.handler(args);
        state.next(makeSubstateSuccessResult(data));
      }
    } catch (error) {
      state.next(makeSubstateFailureResult(error));

      throw error;
    }
  };

  return {
    async run(args: A) {
      await resolve(args);

      return takeFirstSubstateSuccessData(state.asObservable());
    },
    latest() {
      return state.getValue();
    },
    data() {
      return filterSubstateSuccessAndMapToData(state.asObservable());
    },
    stream() {
      return state.asObservable();
    },
  };
}
