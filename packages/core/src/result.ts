import type {
  CascadeData,
  CascadeFailureResult,
  CascadeNonReadyResult,
  CascadeResult,
  CascadeSuccessResult,
} from "./types";

export function makeCascadeNonReadyResult(): CascadeNonReadyResult {
  return {
    ready: false,
  };
}

export function makeCascadeFailureResult(erro: unknown): CascadeFailureResult {
  return {
    ready: true,
    success: false,
    error: erro,
  };
}

export function makeCascadeSuccessResult<T extends CascadeData>(
  data: T,
): CascadeSuccessResult<T> {
  return {
    ready: true,
    success: true,
    data,
  };
}

export function makeCascadeResult<T extends CascadeData>(
  input: { data: T } | { error: unknown } | {} = {},
): CascadeResult<T> {
  if ("data" in input) {
    return makeCascadeSuccessResult(input.data);
  }
  if ("error" in input) {
    return makeCascadeFailureResult(input.error);
  }
  return makeCascadeNonReadyResult();
}
