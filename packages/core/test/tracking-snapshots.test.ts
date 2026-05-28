import { describe, expect, it } from "vitest";
import { createStore, createSubStore } from "../src/index";

describe("substate tracking and snapshots", () => {
  it("records mutation invocations", async () => {
    const storeDef = createSubStore({}, (builder) => {
      const mut = builder.mutation(async (args: { value: number }) => ({
        data: args.value + 1,
      }));
      return { mut };
    });

    const store = createStore({ storeDef });

    store.storeDef.mut().run({ value: 1 });

    expect(store.isPending()).toBe(true);
    await store.whenIdle();
    expect(store.isPending()).toBe(false);
  });

  it("updates snapshots after successful runs", async () => {
    const storeDef = createSubStore({}, (builder) => {
      const sel = builder.selector(async () => ({ data: "ready" }));
      const mut = builder.mutation(async () => ({ data: "done" }));
      return { sel, mut };
    });

    const store = createStore({ storeDef });
    await store.storeDef.sel().resolve();
    await store.storeDef.mut().run({});

    const snapshot = store.getSnapshot();
    expect(snapshot.storeDef?.sel).toEqual({ data: "ready" });
    expect(snapshot.storeDef?.mut).toEqual({ data: "done" });
  });
});
