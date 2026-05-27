import { describe, expect, it } from "vitest";
import { createSubstateReact } from "../src/index";

describe("createSubstateReact", () => {
  it("creates a typed provider and hook pair", () => {
    const bindings = createSubstateReact<{ value: number }>();

    expect(typeof bindings.Provider).toBe("function");
    expect(typeof bindings.useState).toBe("function");
  });
});
