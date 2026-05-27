import { describe, expect, it } from "vitest";
import { createCascadeStore, createCascadeSubStore } from "../src/index";

describe("cascade tracking and snapshots", () => {
  it("records mutation invocations", async () => {
    const storeDef = createCascadeSubStore({}, (builder) => {
      const mut = builder.mutation(async (args: { value: number }) => ({
        data: args.value + 1,
      }));
      return { mut };
    });

    const store = createCascadeStore({ storeDef });

    store.storeDef.mut().run({ value: 1 });

    expect(store.isPending()).toBe(true);
    await store.whenIdle();
    expect(store.isPending()).toBe(false);
  });

  it("updates snapshots after successful runs", async () => {
    const storeDef = createCascadeSubStore({}, (builder) => {
      const sel = builder.selector(async () => ({ data: "ready" }));
      const mut = builder.mutation(async () => ({ data: "done" }));
      return { sel, mut };
    });

    const store = createCascadeStore({ storeDef });
    await store.storeDef.sel().resolve();
    await store.storeDef.mut().run({});

    const snapshot = store.getSnapshot();
    expect(snapshot.storeDef?.sel).toEqual({ data: "ready" });
    expect(snapshot.storeDef?.mut).toEqual({ data: "done" });
  });
});
