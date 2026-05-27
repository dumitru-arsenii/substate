import { BehaviorSubject, defer, Observable, shareReplay, tap } from "rxjs";
import type { Subscriber, Subscription } from "rxjs";
import {
  getCascadeDependenciesUnsafe,
  listenCascadeDependencies,
} from "./dependencies";
import {
  makeCascadeFailureResult,
  makeCascadeNonReadyResult,
  makeCascadeSuccessResult,
} from "./result";
import type {
  CascadeData,
  CascadeResult,
  CascadeSelector,
  CascadeSelectorContext,
} from "./types";
import {
  filterCascadeSuccessAndMapToData,
  takeFirstCascadeSuccessData,
} from "./utils";

export function createCascadeSelectorFlow<T extends CascadeData>(
  context: CascadeSelectorContext<T>,
): CascadeSelector<T> {
  const state = new BehaviorSubject<CascadeResult<T>>(
    context.initialData
      ? makeCascadeSuccessResult(context.initialData)
      : makeCascadeNonReadyResult(),
  );

  const resolve = async () => {
    context.logger.debug("resolve started");
    try {
      const canResolve = context.filterFn();

      context.logger.debug("can resolve", canResolve);

      if (canResolve) {
        const data = await context.handler();
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

  let dependenciesSubscription: Subscription | undefined;
  const subjectStream$ = state.asObservable().pipe(
    tap((data) => {
      context.logger.debug("result", data);
    }),
  );
  const stream$ = defer(
    () =>
      new Observable<CascadeResult<T>>(
        (subscriber: Subscriber<CascadeResult<T>>) => {
          const subscription = subjectStream$.subscribe(subscriber);

          context.logger.debug("subscribe");

          if (!state.getValue().ready) {
            context.logger.debug("initial resolve from subscribe");
            void resolve().catch((error) => {
              context.logger.debug(
                "initial resolve rejected (state already updated)",
                error,
              );
            });
          }

          dependenciesSubscription = listenCascadeDependencies(
            context.dependencies,
          ).subscribe(() => {
            context.logger.debug(
              "dependencies changed",
              getCascadeDependenciesUnsafe(context.dependencies),
            );
            if (!state.getValue().ready) {
              context.logger.debug("initial resolve from dependencies change");
              void resolve().catch((error) => {
                context.logger.debug(
                  "dependencies resolve rejected (state already updated)",
                  error,
                );
              });
            }
          });

          return () => {
            context.logger.debug("unsubscribe");
            subscription.unsubscribe();
            dependenciesSubscription?.unsubscribe();
          };
        },
      ),
  ).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  return {
    latest() {
      context.logger.debug("latest accessed");
      return state.getValue();
    },
    async resolve() {
      context.logger.debug("resolve triggered");

      await resolve();

      return takeFirstCascadeSuccessData(state.asObservable());
    },
    data() {
      context.logger.debug("data accessed");
      return filterCascadeSuccessAndMapToData(stream$).pipe(
        tap((data) => {
          context.logger.debug("data", data);
        }),
      );
    },
    stream() {
      context.logger.debug("stream accessed");
      return stream$;
    },
  };
}
