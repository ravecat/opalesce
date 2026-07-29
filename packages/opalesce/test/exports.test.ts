import { describe, expect, it } from "vitest";
import * as config from "../src/config.js";
import * as facade from "../src/index.js";

describe("facade exports", () => {
  it("exposes a deliberate root runtime API", () => {
    expect(Object.keys(facade).sort()).toEqual(["defineConfig", "definePlugin"]);
  });

  it("maps project config without wrapping it", () => {
    expect(Object.keys(config)).toEqual(["defineConfig"]);
    expect(facade.defineConfig).toBe(config.defineConfig);
  });

  it("keeps project config authoring side-effect free", () => {
    const projectConfig = {
      input: "./asyncapi.yaml",
      output: {
        path: "./generated",
      },
    };

    expect(facade.defineConfig(projectConfig)).toBe(projectConfig);
  });
});
