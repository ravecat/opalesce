import { describe, expect, test } from "vitest";
import { PluginManager } from "~/runtime/PluginManager";
import type { GenerationContext, PluginInstance } from "~/types";

function createContext(): GenerationContext {
  return {
    cwd: process.cwd(),
    config: {
      input: { path: "./asyncapi.yaml" },
      output: { path: "generated" },
      plugins: [],
    },
    asyncapi: null,
    graph: null,
    diagnostics: [],
    artifacts: [],
  };
}

describe("PluginManager", () => {
  test("runs plugins in dependency order", async () => {
    const calls: string[] = [];
    const plugins: PluginInstance[] = [
      {
        name: "asyncapi",
        options: {},
        async install() {
          calls.push("asyncapi");
        },
      },
      {
        name: "typescript",
        options: {},
        pre: ["asyncapi"],
        async install() {
          calls.push("typescript");
        },
      },
    ];

    const manager = new PluginManager({
      input: { path: "./asyncapi.yaml" },
      output: { path: "generated" },
      plugins,
    });

    await manager.run(createContext());

    expect(calls).toEqual(["asyncapi", "typescript"]);
  });

  test("rejects when required dependencies are missing", () => {
    const manager = new PluginManager({
      input: { path: "./asyncapi.yaml" },
      output: { path: "generated" },
      plugins: [
        {
          name: "typescript",
          options: {},
          pre: ["asyncapi"],
          install() {},
        },
      ],
    });

    expect(() => manager.sortByDependencies(manager.plugins)).toThrow(
      'Plugin "typescript" requires missing dependencies: asyncapi',
    );
  });
});
