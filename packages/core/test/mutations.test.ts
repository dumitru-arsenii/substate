import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import { createStore, createSubStore } from "../src/index";

describe("substate mutations", () => {
  it("only runs on args changes", async () => {
    let current = 1;
    const calls: Array<{ args: number; dep: number }> = [];

    const storeDef = createSubStore({}, (builder) => {
      const dep = builder.selector(async () => ({ current }));
      const mut = builder
        .withDependencies({ dep })
        .mutation(async (args: { value: number }, deps) => {
          calls.push({ args: args.value, dep: deps.dep.current });
          return { data: args.value + deps.dep.current };
        });
      return { dep, mut };
    });

    const store = createStore({ storeDef });
    const dep = store.storeDef.dep();
    const mut = store.storeDef.mut();

    await dep.resolve();
    await mut.run({ value: 1 });

    current = 5;
    await dep.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).toHaveLength(1);
  });

  it("captures errors without throwing", async () => {
    const storeDef = createSubStore({}, (builder) => {
      const mut = builder.mutation(async (): Promise<{}> => {
        console.trace("boom");
        throw new Error("boom");
      });
      return { mut };
    });

    const store = createStore({ storeDef });
    const mut = store.storeDef.mut();

    await expect(firstValueFrom(mut.stream())).resolves.toMatchObject({
      ready: false,
    });

    await expect(mut.run({})).rejects.toThrowError("boom");

    await expect(firstValueFrom(mut.stream())).resolves.toMatchObject({
      ready: true,
      success: false,
      error: {
        message: "boom",
      },
    });
  });

  it("substates mutations across substores", async () => {
    const base = createSubStore({}, (builder) => {
      const bump = builder.mutation(async (args: { amount: number }) => ({
        data: args.amount,
      }));
      const total = builder
        .withDependencies({ bump })
        .selector(async ({ bump }) => ({ value: bump.data + 1 }));

      return { bump, total };
    });

    const derived = createSubStore({ base }, (builder, deps) => {
      const touch = builder
        .withDependencies({ total: deps.base.total })
        .mutation(async (_, deps) => ({
          data: `total:${deps.total.value}`,
        }));
      return { touch };
    });

    const store = createStore({ base, derived });
    await store.base.bump().run({ amount: 4 });
    await store.base.total().resolve();
    const result = await store.derived.touch().run({});
    expect(result).toMatchObject({ data: "total:5" });
  });
});
