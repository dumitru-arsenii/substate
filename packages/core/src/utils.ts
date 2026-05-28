import { filter, firstValueFrom, map, Observable } from "rxjs";
import type {
  SubstateArgs,
  SubstateData,
  SubstateResult,
  SubstateSuccessResult,
} from "./types";

export function getArgsKey(args: SubstateArgs): string {
  return JSON.stringify(args);
}

export function filterSubstateSuccessResult<T extends SubstateData>(
  strea: Observable<SubstateResult<T>>,
): Observable<SubstateSuccessResult<T>> {
  return strea.pipe(
    filter(
      (result): result is SubstateSuccessResult<T> =>
        result.ready && result.success,
    ),
  );
}

export function filterSubstateSuccessAndMapToData<T extends SubstateData>(
  strea: Observable<SubstateResult<T>>,
): Observable<T> {
  return filterSubstateSuccessResult(strea).pipe(map((result) => result.data));
}

export function takeFirstSubstateSuccessData<T extends SubstateData>(
  strea: Observable<SubstateResult<T>>,
): Promise<T> {
  return firstValueFrom(filterSubstateSuccessAndMapToData(strea));
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
