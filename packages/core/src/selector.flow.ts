import { BehaviorSubject, defer, Observable, shareReplay, skip } from "rxjs";
import type { Subscriber, Subscription } from "rxjs";
import { listenSubstateDependencies } from "./dependencies";
import {
  makeSubstateFailureResult,
  makeSubstateNonReadyResult,
  makeSubstateSuccessResult,
} from "./result";
import type {
  SubstateData,
  SubstateResult,
  SubstateSelector,
  SubstateSelectorContext,
} from "./types";
import {
  filterSubstateSuccessAndMapToData,
  takeFirstSubstateSuccessData,
} from "./utils";

export function createSubstateSelectorFlow<T extends SubstateData>(
  context: SubstateSelectorContext<T>,
): SubstateSelector<T> {
  const state = new BehaviorSubject<SubstateResult<T>>(
    context.initialData
      ? makeSubstateSuccessResult(context.initialData)
      : makeSubstateNonReadyResult(),
  );

  const resolve = async () => {
    try {
      const canResolve = context.filterFn();

      if (canResolve) {
        const data = await context.handler();
        state.next(makeSubstateSuccessResult(data));
      }
    } catch (error) {
      state.next(makeSubstateFailureResult(error));

      throw error;
    }
  };

  let dependenciesSubscription: Subscription | undefined;
  const subjectStream$ = state.asObservable();
  const stream$ = defer(
    () =>
      new Observable<SubstateResult<T>>(
        (subscriber: Subscriber<SubstateResult<T>>) => {
          const subscription = subjectStream$.subscribe(subscriber);

          if (!state.getValue().ready) {
            void resolve().catch(() => {});
          }

          dependenciesSubscription = listenSubstateDependencies(
            context.dependencies,
          )
            .pipe(skip(1))
            .subscribe(() => {
              void resolve().catch(() => {});
            });

          return () => {
            subscription.unsubscribe();
            dependenciesSubscription?.unsubscribe();
          };
        },
      ),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  return {
    latest() {
      return state.getValue();
    },
    async resolve() {
      await resolve();

      return takeFirstSubstateSuccessData(state.asObservable());
    },
    data() {
      return filterSubstateSuccessAndMapToData(stream$);
    },
    stream() {
      return stream$;
    },
  };
}
