import type {
  SubstateFlow,
  SubstateFlowData,
  SubstateFlowInitializer,
  SubstateFlowInitializerContext,
} from "./types";

export function createSubstateInitializer<F extends SubstateFlow<any>>(
  createFlow: (() => F) | ((args: any) => F),
  onInitialize: (
    context: SubstateFlowInitializerContext<SubstateFlowData<F>>,
  ) => void,
): SubstateFlowInitializer<SubstateFlowData<F>> {
  let initialized = false;

  return Object.assign(createFlow, {
    isInitialized() {
      return initialized;
    },
    initialize(context: SubstateFlowInitializerContext<SubstateFlowData<F>>) {
      initialized = true;
      onInitialize(context);
    },
  }) as SubstateFlowInitializer<SubstateFlowData<F>>;
}
