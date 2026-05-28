import { Observable, firstValueFrom } from "rxjs";
import { describe, expect, it } from "vitest";
import {
  createStore,
  createSubStore,
  type SubstateSuccessResult,
} from "../src/index";

describe("substate subscriptions", () => {
  it("tracks invocation after first emission", async () => {
    const feeds = createSubStore({}, (builder) => {
      const stream = builder.subscription((args: { start: number }) => {
        return new Observable<{ data: number }>((subscriber) => {
          subscriber.next({ data: args.start });
          subscriber.complete();
        });
      });
      return { stream };
    });

    const store = createStore({ feeds });
    const stream = store.feeds.stream();

    const first = firstValueFrom(stream.watch({ start: 2 }));

    expect(store.isPending()).toBe(false);
    await store.whenIdle();
    await expect(first).resolves.toMatchObject({ data: 2 });
    expect(store.isPending()).toBe(false);
  });

  it("captures errors as results", async () => {
    const feeds = createSubStore({}, (builder) => {
      const stream = builder.subscription(() => {
        return new Observable<{ data: number }>((subscriber) => {
          subscriber.error(new Error("nope"));
        });
      });
      return { stream };
    });

    const store = createStore({ feeds });
    const stream = store.feeds.stream();

    stream.watch({});

    const result = await firstValueFrom(stream.stream());
    expect(result).toMatchObject({
      ready: true,
      success: false,
      error: { message: "nope" },
    });
  });

  it("switches streams when args change", async () => {
    const subscribersArgs: number[] = [];
    const feeds = createSubStore({}, (builder) => {
      const stream = builder.subscription((args: { start: number }) => {
        return new Observable<{ data: number }>((subscriber) => {
          subscribersArgs.push(args.start);
          subscriber.next({ data: args.start });
        });
      });
      return { stream };
    });

    const store = createStore({ feeds });
    const stream = store.feeds.stream();

    stream.watch({ start: 1 });
    const first = await firstValueFrom(stream.stream());
    stream.watch({ start: 5 });
    const second = await firstValueFrom(stream.stream());
    stream.watch({ start: 10 });
    const third = await firstValueFrom(stream.stream());

    const firstResult = first as SubstateSuccessResult<{ data: number }>;
    const secondResult = second as SubstateSuccessResult<{ data: number }>;
    const thirdResult = third as SubstateSuccessResult<{ data: number }>;

    expect(subscribersArgs).toEqual([1, 5, 10]);
    expect(firstResult.data).toMatchObject({ data: 1 });
    expect(secondResult.data).toMatchObject({ data: 5 });
    expect(thirdResult.data).toMatchObject({ data: 10 });
  });
});
