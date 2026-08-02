import { describe, expect, it } from "vitest";
import * as core from "../src/index.js";

describe("Core exports", () => {
  it("exposes the linear runtime API without graph or service contracts", () => {
    expect(core).toMatchObject({
      ArtifactError: expect.any(Function),
      AsyncAPIParseError: expect.any(Function),
      PluginExecutionError: expect.any(Function),
      defineConfig: expect.any(Function),
      definePlugin: expect.any(Function),
      parseAsyncAPI: expect.any(Function),
      run: expect.any(Function),
    });
    expect(core).not.toHaveProperty("createServiceToken");
    expect(core).not.toHaveProperty("PluginConfigurationError");
    expect(core).not.toHaveProperty("ServiceRegistryError");
  });
});
