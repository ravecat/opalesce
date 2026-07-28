import { describe, expect, it } from "vitest";
import { defineConfig } from "../src/index.js";

describe("defineConfig", () => {
  it("returns the same config without executing side effects", () => {
    const config = {
      input: "./asyncapi.yaml",
      output: {
        path: "./generated",
      },
      plugins: [],
    };

    expect(defineConfig(config)).toBe(config);
  });
});
