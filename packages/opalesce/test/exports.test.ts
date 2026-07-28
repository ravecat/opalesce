import { describe, expect, it } from "vitest";
import * as config from "../src/config.js";
import * as facade from "../src/index.js";
import * as orchestrator from "../src/orchestrator.js";

describe("facade exports", () => {
  it("exposes a deliberate root runtime API", () => {
    expect(Object.keys(facade).sort()).toEqual([
      "ArtifactError",
      "PluginConfigurationError",
      "PluginExecutionError",
      "ServiceRegistryError",
      "createServiceToken",
      "defineConfig",
      "definePipelineConfig",
      "definePlugin",
      "runPipeline",
    ]);
  });

  it("maps config and orchestration helpers without wrapping them", () => {
    expect(Object.keys(config)).toEqual(["defineConfig"]);
    expect(Object.keys(orchestrator).sort()).toEqual([
      "ArtifactError",
      "PluginConfigurationError",
      "PluginExecutionError",
      "ServiceRegistryError",
      "createServiceToken",
      "defineConfig",
      "definePlugin",
      "runPipeline",
    ]);
    expect(facade.defineConfig).toBe(config.defineConfig);
    expect(facade.definePipelineConfig).toBe(orchestrator.defineConfig);
    expect(facade.definePlugin).toBe(orchestrator.definePlugin);
    expect(facade.runPipeline).toBe(orchestrator.runPipeline);
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
