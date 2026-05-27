import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import { createCascadeStore, createCascadeSubStore } from "../src/index";
import type { CascadeStoreSnapshot } from "../src/types";
import { getArgsKey } from "../src/utils";

describe("cascade isolated selectors", () => {
  it("seeds from snapshots and memoizes flows", async () => {
    const catalog = createCascadeSubStore({}, (builder) => {
      const byId = builder.isolated(async (args: { id: number }) => ({
        id: args.id,
        name: "Live",
      }));
      return { byId };
    });

    const argsKey = getArgsKey({ id: 1 });
    const ss = { catalog };
    const snapshot: CascadeStoreSnapshot<typeof ss> = {
      catalog: {
        byId: {
          [argsKey]: {
            id: 1,
            name: "Seed",
          },
        },
      },
    };

    const store = createCascadeStore({ catalog }, snapshot);
    const flow1 = store.catalog.byId({ id: 1 });
    const flow2 = store.catalog.byId({ id: 1 });

    expect(flow1).toBe(flow2);

    const seeded1 = await firstValueFrom(flow1.stream());

    expect(seeded1).toMatchObject({
      ready: true,
      success: true,
      data: { id: 1, name: "Seed" },
    });

    const seeded2 = await firstValueFrom(flow2.stream());

    expect(seeded2).toMatchObject({
      ready: true,
      success: true,
      data: { id: 1, name: "Seed" },
    });

    await flow1.resolve();

    const updated = store.getSnapshot();

    expect(updated).toBeDefined();
    expect(updated?.catalog).toBeDefined();
    expect(updated?.catalog?.byId).toBeDefined();
    expect(updated?.catalog?.byId?.[argsKey]).toEqual({
      id: 1,
      name: "Live",
    });
  });

  it("tracks resolve invocations with argsKey", async () => {
    const catalog = createCascadeSubStore({}, (builder) => {
      const byId = builder.isolated(async (args: { id: number }) => ({
        id: args.id,
      }));
      return { byId };
    });

    const store = createCascadeStore({ catalog });
    const flow = store.catalog.byId({ id: 2 });

    flow.resolve();

    expect(store.isPending()).toBe(true);
    await store.whenIdle();
    expect(store.isPending()).toBe(false);
  });

  it("isolated selectors depend on cross-substore flows", async () => {
    const users = createCascadeSubStore({}, (builder) => {
      const setUser = builder.mutation(
        async (args: { id: number; name: string }) => args,
      );
      const current = builder
        .withDependencies({ setUser })
        .selector(async ({ setUser }) => setUser);
      return { setUser, current };
    });

    const profiles = createCascadeSubStore({ users }, (builder, deps) => {
      const byId = builder
        .withDependencies({ user: deps.users.current })
        .isolated(async (args: { id: number }, { user }) => {
          return user && user.id === args.id
            ? { id: args.id, label: user.name }
            : {};
        });
      return { byId };
    });

    const store = createCascadeStore({ users, profiles });
    await store.users.setUser().run({ id: 7, name: "Ada" });

    const flow = store.profiles.byId({ id: 7 });
    const result = await flow.resolve();
    expect(result).toEqual({ id: 7, label: "Ada" });
  });
});
