import { beforeAll, describe, expect, it } from "vitest";
import {
  ArtifactError,
  AsyncAPIParseError,
  parseAsyncAPI,
  PluginExecutionError,
  run,
  type Input,
  type OrchestrationPlugin,
  type PluginContext,
} from "../src/index.js";

const source: Input = {
  asyncapi: "3.1.0",
  info: {
    title: "Core pipeline",
    version: "1.0.0",
  },
};
let input: Input = source;

beforeAll(async () => {
  input = (await parseAsyncAPI(source)).document;
});

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

function expectPluginCause(rejection: unknown, pluginName: string): unknown {
  expect(rejection).toBeInstanceOf(PluginExecutionError);

  if (!(rejection instanceof PluginExecutionError)) {
    throw new Error("Expected PluginExecutionError.");
  }

  expect(rejection.pluginName).toBe(pluginName);
  expect("phase" in rejection).toBe(false);
  return rejection.cause;
}

describe("run", () => {
  it("returns an immutable empty result for a pipeline without plugins", async () => {
    const result = await run({ input });

    expect(result.document.version()).toBe("3.1.0");
    expect(result.artifacts).toEqual([]);
    expect(result.pluginNames).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.artifacts)).toBe(true);
    expect(Object.isFrozen(result.pluginNames)).toBe(true);
    expect(Reflect.set(result.artifacts, 0, { path: "late.txt", contents: "late" })).toBe(false);
    expect(Reflect.set(result.pluginNames, 0, "late")).toBe(false);
  });

  it("preserves Core parse errors and runs no plugin generation", async () => {
    const calls: string[] = [];
    const rejection = await rejectionOf(
      run({
        input: "asyncapi: 3.1.0",
        plugins: [
          {
            name: "never",
            generate() {
              calls.push("generate");
              return [];
            },
          },
        ],
      }),
    );

    expect(rejection).toBeInstanceOf(AsyncAPIParseError);
    expect(rejection).not.toBeInstanceOf(PluginExecutionError);
    expect(calls).toEqual([]);
  });
});

describe("linear plugin execution", () => {
  it("runs every configured entry exactly once in declared order", async () => {
    const calls: string[] = [];

    function plugin(name: string): OrchestrationPlugin {
      return {
        name,
        generate() {
          calls.push(name);
          return [];
        },
      };
    }

    const repeated = plugin("second");
    const result = await run({
      input,
      plugins: [repeated, plugin("first"), repeated],
    });

    expect(calls).toEqual(["second", "first", "second"]);
    expect(result.pluginNames).toEqual(["second", "first", "second"]);
  });

  it("snapshots the configured entries before parsing and execution", async () => {
    const calls: string[] = [];
    const plugins: OrchestrationPlugin[] = [];
    const latePlugin: OrchestrationPlugin = {
      name: "late",
      generate() {
        calls.push("late");
        return [];
      },
    };

    plugins.push({
      name: "first",
      generate() {
        calls.push("first");
        plugins.push(latePlugin);
        return [];
      },
    });

    const result = await run({ input, plugins });

    expect(calls).toEqual(["first"]);
    expect(result.pluginNames).toEqual(["first"]);
  });

  it("provides the same parsed document and diagnostics to every generation", async () => {
    const contexts: PluginContext[] = [];
    const result = await run({
      input,
      plugins: [
        {
          name: "first",
          generate(context) {
            contexts.push(context);
            return [];
          },
        },
        {
          name: "second",
          generate(context) {
            contexts.push(context);
            return [];
          },
        },
      ],
    });

    expect(contexts).toHaveLength(2);
    expect(contexts.every((context) => context.document === result.document)).toBe(true);
    expect(contexts.every((context) => context.diagnostics === result.diagnostics)).toBe(true);
    expect(contexts.every((context) => Object.isFrozen(context))).toBe(true);
  });

  it("awaits asynchronous generation before starting the next plugin", async () => {
    const calls: string[] = [];
    let markFirstStarted: (() => void) | undefined;
    let releaseFirst: (() => void) | undefined;
    const firstStarted = new Promise<void>((resolve) => {
      markFirstStarted = resolve;
    });
    const firstRelease = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const resultPromise = run({
      input,
      plugins: [
        {
          name: "first",
          async generate() {
            calls.push("first:start");
            markFirstStarted?.();
            await firstRelease;
            calls.push("first:end");
            return [];
          },
        },
        {
          name: "second",
          generate() {
            calls.push("second");
            return [];
          },
        },
      ],
    });

    await firstStarted;
    expect(calls).toEqual(["first:start"]);

    releaseFirst?.();
    await resultPromise;

    expect(calls).toEqual(["first:start", "first:end", "second"]);
  });
});

describe("artifact collection", () => {
  it("collects defensive frozen artifacts in plugin and return order", async () => {
    const first = {
      path: "types/First.ts",
      contents: "first",
    };

    const result = await run({
      input,
      plugins: [
        {
          name: "first",
          generate() {
            return [first, { path: "types/FirstExtra.ts", contents: "first-extra" }];
          },
        },
        {
          name: "second",
          generate() {
            return [{ path: "types/Second.ts", contents: "second" }];
          },
        },
      ],
    });

    first.path = "mutated.ts";
    first.contents = "mutated";

    expect(result.artifacts).toEqual([
      { path: "types/First.ts", contents: "first" },
      { path: "types/FirstExtra.ts", contents: "first-extra" },
      { path: "types/Second.ts", contents: "second" },
    ]);
    expect(Object.isFrozen(result.artifacts)).toBe(true);
    expect(result.artifacts.every((artifact) => Object.isFrozen(artifact))).toBe(true);
  });

  it.each([
    "",
    ".",
    "./file.ts",
    "../file.ts",
    "types/../file.ts",
    "/file.ts",
    "C:/file.ts",
    "types\\file.ts",
    "types//file.ts",
    "types/",
  ])("rejects invalid artifact path %j", async (path) => {
    const rejection = await rejectionOf(
      run({
        input,
        plugins: [
          {
            name: "invalid-artifact",
            generate() {
              return [{ path, contents: "invalid" }];
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "invalid-artifact");

    expect(cause).toBeInstanceOf(ArtifactError);
    if (!(cause instanceof ArtifactError)) {
      throw new Error("Expected ArtifactError.");
    }
    expect(cause.code).toBe("invalid-path");
    expect(cause.path).toBe(path);
  });

  it("rejects collisions across plugins", async () => {
    const rejection = await rejectionOf(
      run({
        input,
        plugins: [
          {
            name: "first",
            generate() {
              return [{ path: "shared.ts", contents: "first" }];
            },
          },
          {
            name: "second",
            generate() {
              return [{ path: "shared.ts", contents: "second" }];
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "second");

    expect(cause).toBeInstanceOf(ArtifactError);
    if (!(cause instanceof ArtifactError)) {
      throw new Error("Expected ArtifactError.");
    }
    expect(cause.code).toBe("path-collision");
    expect(cause.path).toBe("shared.ts");
  });
});

describe("plugin failures", () => {
  it("retains the generation failure and stops later plugins", async () => {
    const failure = new Error("generation failed");
    const calls: string[] = [];
    const rejection = await rejectionOf(
      run({
        input,
        plugins: [
          {
            name: "failing",
            generate() {
              throw failure;
            },
          },
          {
            name: "later",
            generate() {
              calls.push("later");
              return [];
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "failing");

    expect(cause).toBe(failure);
    expect(calls).toEqual([]);
  });
});
