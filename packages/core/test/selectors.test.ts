import { firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import {
  createCascadeStore,
  createCascadeSubStore,
  type CascadeSuccessResult,
} from "../src/index";

describe("cascade selectors", () => {
  it("resolves when dependencies emit", async () => {
    const users = createCascadeSubStore({}, (builder) => {
      const setValue = builder.mutation(
        async (args: { value: number }) => args,
      );
      const doubled = builder
        .withDependencies({ setValue })
        .selector(async ({ setValue }) => ({ data: setValue.value * 2 }));
      return { setValue, doubled };
    });

    const store = createCascadeStore({ users });
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

  it("exposes latest results and data-only pipe", async () => {
    const storeDef = createCascadeSubStore({}, (builder) => {
      const value = builder.selector(async () => ({ value: 5 }));
      return { value };
    });

    const store = createCascadeStore({ storeDef });
    const value = store.storeDef.value();

    const initial = value.latest();
    expect(initial.ready).toBe(false);

    await value.resolve();
    const latest = value.latest();
    expect(latest.ready).toBe(true);
    expect((latest as CascadeSuccessResult<{ value: number }>).success).toBe(
      true,
    );
    expect(
      (latest as CascadeSuccessResult<{ value: number }>).data,
    ).toMatchObject({
      value: 5,
    });

    const piped = await firstValueFrom(value.stream());
    expect(piped.ready).toBe(true);
    expect((piped as CascadeSuccessResult<{ value: number }>).success).toBe(
      true,
    );
    expect(
      (piped as CascadeSuccessResult<{ value: number }>).data,
    ).toMatchObject({
      value: 5,
    });
  });

  it("seeds selectors from snapshots", async () => {
    const storeDef = createCascadeSubStore({}, (builder) => {
      const value = builder.selector(async () => ({ data: 2 }));
      return { value };
    });

    const snapshot = { storeDef: { value: { data: 10 } } };
    const store = createCascadeStore({ storeDef }, snapshot);
    const value = store.storeDef.value();

    const seeded = await firstValueFrom(value.stream());
    expect((seeded as CascadeSuccessResult<{ data: number }>).ready).toBe(true);
    expect((seeded as CascadeSuccessResult<{ data: number }>).success).toBe(
      true,
    );
    expect(
      (seeded as CascadeSuccessResult<{ data: number }>).data,
    ).toMatchObject({
      data: 10,
    });

    await value.resolve();
    expect(store.getSnapshot()?.storeDef?.value).toMatchObject({
      data: 2,
    });
  });
});
