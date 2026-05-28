import type {
  SubstateData,
  SubstateFailureResult,
  SubstateNonReadyResult,
  SubstateResult,
  SubstateSuccessResult,
} from "./types";

export function makeSubstateNonReadyResult(): SubstateNonReadyResult {
  return {
    ready: false,
  };
}

export function makeSubstateFailureResult(
  erro: unknown,
): SubstateFailureResult {
  return {
    ready: true,
    success: false,
    error: erro,
  };
}

export function makeSubstateSuccessResult<T extends SubstateData>(
  data: T,
): SubstateSuccessResult<T> {
  return {
    ready: true,
    success: true,
    data,
  };
}

export function makeSubstateResult<T extends SubstateData>(
  input: { data: T } | { error: unknown } | {} = {},
): SubstateResult<T> {
  if ("data" in input) {
    return makeSubstateSuccessResult(input.data);
  }
  if ("error" in input) {
    return makeSubstateFailureResult(input.error);
  }
  return makeSubstateNonReadyResult();
}
