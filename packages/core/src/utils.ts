import { filter, firstValueFrom, map, Observable } from "rxjs";
import type {
  CascadeArgs,
  CascadeData,
  CascadeResult,
  CascadeSuccessResult,
} from "./types";

export function getArgsKey(args: CascadeArgs): string {
  return JSON.stringify(args);
}

export function filterCascadeSuccessResult<T extends CascadeData>(
  strea: Observable<CascadeResult<T>>,
): Observable<CascadeSuccessResult<T>> {
  return strea.pipe(
    filter(
      (result): result is CascadeSuccessResult<T> =>
        result.ready && result.success,
    ),
  );
}

export function filterCascadeSuccessAndMapToData<T extends CascadeData>(
  strea: Observable<CascadeResult<T>>,
): Observable<T> {
  return filterCascadeSuccessResult(strea).pipe(map((result) => result.data));
}

export function takeFirstCascadeSuccessData<T extends CascadeData>(
  strea: Observable<CascadeResult<T>>,
): Promise<T> {
  return firstValueFrom(filterCascadeSuccessAndMapToData(strea));
}

type DepsTree = {
  key: string;
  id: string;
  deps: string[];
};

export function sortDepsInOrder(depsTree: DepsTree[]): string[] {
  if (!depsTree.length) return [];

  const { starting, others } = depsTree.reduce(
    (acc, dep): { starting: DepsTree[]; others: DepsTree[] } => {
      if (dep.deps.length) {
        return {
          ...acc,
          others: [...acc.others, dep],
        };
      }

      return {
        ...acc,
        starting: [...acc.starting, dep],
      };
    },
    { starting: [], others: [] },
  );

  if (!starting.length) {
    throw new Error("Circular dependency detected");
  }

  const startinKeys = new Set<string>();
  const startinIds = new Set<string>();

  starting.forEach((dep) => {
    startinIds.add(dep.id);
    startinKeys.add(dep.key);
  });

  return [
    ...startinKeys.values(),
    ...sortDepsInOrder(
      others.map((dep) => {
        const deps = [...dep.deps].filter((depId) => {
          return !startinIds.has(depId);
        });

        return {
          ...dep,
          deps,
        };
      }),
    ),
  ];
}
