import type {
  CascacdeFlow,
  CascadeFlowData,
  CascadeFlowInitializer,
  CascadeFlowInitializerContext,
} from "./types";

export function createCascadeInitializer<F extends CascacdeFlow<any>>(
  createFlow: (() => F) | ((args: any) => F),
  onInitialize: (
    context: CascadeFlowInitializerContext<CascadeFlowData<F>>,
  ) => void,
): CascadeFlowInitializer<CascadeFlowData<F>> {
  let initialized = false;

  return Object.assign(createFlow, {
    isInitialized() {
      return initialized;
    },
    initialize(context: CascadeFlowInitializerContext<CascadeFlowData<F>>) {
      initialized = true;
      onInitialize(context);
    },
  }) as CascadeFlowInitializer<CascadeFlowData<F>>;
}
