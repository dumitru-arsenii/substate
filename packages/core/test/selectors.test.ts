import { firstValueFrom } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import {
  createStore,
  createSubStore,
  type SubstateSuccessResult,
} from "../src/index";

describe("substate selectors", () => {
  it("resolves when dependencies emit", async () => {
    const users = createSubStore({}, (builder) => {
      const setValue = builder.mutation(
        async (args: { value: number }) => args,
      );
      const doubled = builder
        .withDependencies({ setValue })
        .selector(async ({ setValue }) => ({ data: setValue.value * 2 }));
      return { setValue, doubled };
    });

    const store = createStore({ users });
    const setValue = store.users.setValue();
    const doubled = store.users.doubled();

    const nextDoubled = firstValueFrom(doubled.data());

    await setValue.run({ value: 3 });

    await store.whenIdle();

    await expect(nextDoubled).resolves.toMatchObject({
      data: 6,
    });

    const resolved = await doubled.resolve();

    expect(resolved).toMatchObject({
      data: 6,
    });
  });

  it("re-resolves when ready dependencies change", async () => {
    const users = createSubStore({}, (builder) => {
      const setValue = builder.mutation(
        async (args: { value: number }) => args,
      );
      const doubled = builder
        .withDependencies({ setValue })
        .selector(async ({ setValue }) => ({ data: setValue.value * 2 }));
      return { setValue, doubled };
    });

    const store = createStore({ users });
    const setValue = store.users.setValue();
    const doubled = store.users.doubled();

    doubled.stream().subscribe();

    await setValue.run({ value: 3 });
    await store.whenIdle();

    expect(doubled.latest()).toMatchObject({
      ready: true,
      success: true,
      data: { data: 6 },
    });

    await setValue.run({ value: 5 });
    await store.whenIdle();

    expect(doubled.latest()).toMatchObject({
      ready: true,
      success: true,
      data: { data: 10 },
    });
  });

  it("re-resolves seeded selectors when dependencies change", async () => {
    const handler = vi.fn(
      async ({ setValue }: { setValue: { value: number } }) => ({
        data: setValue.value * 2,
      }),
    );
    const users = createSubStore({}, (builder) => {
      const setValue = builder.mutation(
        async (args: { value: number }) => args,
      );
      const doubled = builder.withDependencies({ setValue }).selector(handler);
      return { setValue, doubled };
    });

    const store = createStore(
      { users },
      {
        users: {
          setValue: { value: 2 },
          doubled: { data: 4 },
        },
      },
    );
    const setValue = store.users.setValue();
    const doubled = store.users.doubled();

    const subscription = doubled.stream().subscribe();

    expect(doubled.latest()).toMatchObject({
      ready: true,
      success: true,
      data: { data: 4 },
    });
    expect(handler).not.toHaveBeenCalled();

    await setValue.run({ value: 6 });
    await store.whenIdle();

    expect(doubled.latest()).toMatchObject({
      ready: true,
      success: true,
      data: { data: 12 },
    });
    expect(handler).toHaveBeenCalledTimes(1);

    subscription.unsubscribe();
  });

  it("does not resolve seeded selectors from subscription before dependencies change", async () => {
    const handler = vi.fn(
      async ({ setValue }: { setValue: { value: number } }) => ({
        data: setValue.value * 2,
      }),
    );
    const users = createSubStore({}, (builder) => {
      const setValue = builder.mutation(
        async (args: { value: number }) => args,
      );
      const doubled = builder.withDependencies({ setValue }).selector(handler);
      return { setValue, doubled };
    });

    const store = createStore(
      { users },
      {
        users: {
          setValue: { value: 2 },
          doubled: { data: 4 },
        },
      },
    );
    const doubled = store.users.doubled();

    const subscription = doubled.stream().subscribe();
    await store.whenIdle();

    expect(doubled.latest()).toMatchObject({
      ready: true,
      success: true,
      data: { data: 4 },
    });
    expect(handler).not.toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("resolves seeded selectors when manually triggered", async () => {
    const handler = vi.fn(
      async ({ setValue }: { setValue: { value: number } }) => ({
        data: setValue.value * 2,
      }),
    );
    const users = createSubStore({}, (builder) => {
      const setValue = builder.mutation(
        async (args: { value: number }) => args,
      );
      const doubled = builder.withDependencies({ setValue }).selector(handler);
      return { setValue, doubled };
    });

    const store = createStore(
      { users },
      {
        users: {
          setValue: { value: 2 },
          doubled: { data: 4 },
        },
      },
    );
    const doubled = store.users.doubled();

    const resolved = await doubled.resolve();

    expect(resolved).toMatchObject({ data: 4 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("exposes latest results and data-only pipe", async () => {
    const storeDef = createSubStore({}, (builder) => {
      const value = builder.selector(async () => ({ value: 5 }));
      return { value };
    });

    const store = createStore({ storeDef });
    const value = store.storeDef.value();

    const initial = value.latest();
    expect(initial.ready).toBe(false);

    await value.resolve();
    const latest = value.latest();
    expect(latest.ready).toBe(true);
    expect((latest as SubstateSuccessResult<{ value: number }>).success).toBe(
      true,
    );
    expect(
      (latest as SubstateSuccessResult<{ value: number }>).data,
    ).toMatchObject({
      value: 5,
    });

    const piped = await firstValueFrom(value.stream());
    expect(piped.ready).toBe(true);
    expect((piped as SubstateSuccessResult<{ value: number }>).success).toBe(
      true,
    );
    expect(
      (piped as SubstateSuccessResult<{ value: number }>).data,
    ).toMatchObject({
      value: 5,
    });
  });

  it("seeds selectors from snapshots", async () => {
    const handler = vi.fn(async () => ({ data: 2 }));
    const storeDef = createSubStore({}, (builder) => {
      const value = builder.selector(handler);
      return { value };
    });

    const snapshot = { storeDef: { value: { data: 10 } } };
    const store = createStore({ storeDef }, snapshot);
    const value = store.storeDef.value();

    const seeded = await firstValueFrom(value.stream());
    expect((seeded as SubstateSuccessResult<{ data: number }>).ready).toBe(
      true,
    );
    expect((seeded as SubstateSuccessResult<{ data: number }>).success).toBe(
      true,
    );
    expect(
      (seeded as SubstateSuccessResult<{ data: number }>).data,
    ).toMatchObject({
      data: 10,
    });

    await value.resolve();
    expect(store.getSnapshot()?.storeDef?.value).toMatchObject({
      data: 2,
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });
});
