import { Observable } from "rxjs";
import type { CascadeData, CascadeTracker } from "./types";

export function createTracker(
  initialData: Record<string, Record<string, CascadeData>>,
): CascadeTracker {
  const pendingPromises = new Set<Promise<void>>();
  const snapshot = { ...initialData };

  const applyDumpData = (
    substoreKey: string,
    flowKey: string,
    data: CascadeData,
    argsKey?: string,
  ) => {
    if (argsKey) {
      (
        ((snapshot[substoreKey] ??= {})[flowKey] ??= {}) as Record<
          string,
          CascadeData
        >
      )[argsKey] = data;
    } else {
      (snapshot[substoreKey] ??= {})[flowKey] = data;
    }
    return data;
  };

  return {
    wrapExecution<Fn extends (...args: any[]) => any>(
      handler: Fn,
      substoreKey: string,
      flowKey: string,
      argsKey?: string,
    ): Fn {
      return ((...args: any[]) => {
        const result = handler(...args);

        if (result instanceof Promise) {
          pendingPromises.add(result);

          return result.then(
            (data) => {
              pendingPromises.delete(result);

              return applyDumpData(substoreKey, flowKey, data, argsKey);
            },
            (err) => {
              pendingPromises.delete(result);

              throw err;
            },
          );
        }

        if (result instanceof Observable) {
          return result;
        }

        return applyDumpData(substoreKey, flowKey, result, argsKey);
      }) as Fn;
    },
    async whenIdle() {
      if (!pendingPromises.size) return;
      await Promise.all([...pendingPromises]);
    },
    isPending: () => pendingPromises.size > 0,
    getSnapshot: () => ({ ...snapshot }),
  };
}
