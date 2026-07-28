import { beforeAll, describe, expect, it } from "vitest";
import {
  ArtifactError,
  AsyncAPIParseError,
  createServiceToken,
  parseAsyncAPI,
  PluginConfigurationError,
  PluginExecutionError,
  run,
  ServiceRegistryError,
  type GeneratedArtifact,
  type Input,
  type OrchestrationPlugin,
} from "../src/index.js";

const source: Input = {
  asyncapi: "3.1.0",
  info: {
    title: "Orchestrator",
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

function expectPluginCause(
  rejection: unknown,
  pluginName: string,
  phase: "setup" | "build",
): unknown {
  expect(rejection).toBeInstanceOf(PluginExecutionError);

  if (!(rejection instanceof PluginExecutionError)) {
    throw new Error("Expected PluginExecutionError.");
  }

  expect(rejection.pluginName).toBe(pluginName);
  expect(rejection.phase).toBe(phase);
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

  it("preserves Core parse errors and runs no plugin hook", async () => {
    const calls: string[] = [];
    const rejection = await rejectionOf(
      run({
        input: "asyncapi: 3.1.0",
        plugins: [
          {
            name: "never",
            setup() {
              calls.push("setup");
            },
            build() {
              calls.push("build");
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

describe("plugin ordering", () => {
  it("runs every setup before builds in stable dependency order", async () => {
    const calls: string[] = [];

    function plugin(name: string, dependsOn: readonly string[] = []): OrchestrationPlugin {
      return {
        name,
        dependsOn,
        setup() {
          calls.push(`setup:${name}`);
        },
        build() {
          calls.push(`build:${name}`);
        },
      };
    }

    const result = await run({
      input,
      plugins: [
        plugin("consumer", ["provider"]),
        plugin("independent"),
        plugin("provider"),
        plugin("last"),
      ],
    });

    expect(result.pluginNames).toEqual(["independent", "provider", "consumer", "last"]);
    expect(calls).toEqual([
      "setup:independent",
      "setup:provider",
      "setup:consumer",
      "setup:last",
      "build:independent",
      "build:provider",
      "build:consumer",
      "build:last",
    ]);
  });

  it("allows setup-only and build-only plugins", async () => {
    const calls: string[] = [];

    await run({
      input,
      plugins: [
        {
          name: "setup-only",
          setup() {
            calls.push("setup");
          },
        },
        {
          name: "build-only",
          build() {
            calls.push("build");
          },
        },
      ],
    });

    expect(calls).toEqual(["setup", "build"]);
  });

  it.each([
    {
      name: "empty name",
      plugins: [{ name: "   " }],
      code: "empty-name",
    },
    {
      name: "duplicate name",
      plugins: [{ name: "duplicate" }, { name: "duplicate" }],
      code: "duplicate-name",
    },
    {
      name: "missing dependency",
      plugins: [{ name: "consumer", dependsOn: ["missing"] }],
      code: "missing-dependency",
    },
    {
      name: "self dependency",
      plugins: [{ name: "self", dependsOn: ["self"] }],
      code: "dependency-cycle",
    },
    {
      name: "dependency cycle",
      plugins: [
        { name: "first", dependsOn: ["second"] },
        { name: "second", dependsOn: ["first"] },
      ],
      code: "dependency-cycle",
    },
  ] satisfies {
    readonly name: string;
    readonly plugins: readonly OrchestrationPlugin[];
    readonly code: PluginConfigurationError["code"];
  }[])("rejects $name before parsing", async ({ plugins, code }) => {
    const rejection = await rejectionOf(
      run({
        input: "invalid input that Core must not parse",
        plugins,
      }),
    );

    expect(rejection).toBeInstanceOf(PluginConfigurationError);
    expect(rejection).not.toBeInstanceOf(AsyncAPIParseError);

    if (!(rejection instanceof PluginConfigurationError)) {
      throw new Error("Expected PluginConfigurationError.");
    }

    expect(rejection.code).toBe(code);
    expect(Object.isFrozen(rejection.pluginNames)).toBe(true);
  });
});

describe("shared services", () => {
  it("shares typed values by token identity and isolates equal token names", async () => {
    const firstToken = createServiceToken<number>("value");
    const secondToken = createServiceToken<string>("value");
    const consumed: Array<number | string> = [];

    await run({
      input,
      plugins: [
        {
          name: "provider",
          setup(context) {
            context.provide(firstToken, 42);
            context.provide(secondToken, "second");
          },
        },
        {
          name: "consumer",
          dependsOn: ["provider"],
          setup(context) {
            consumed.push(context.get(firstToken));
          },
          build(context) {
            consumed.push(context.get(secondToken));
          },
        },
      ],
    });

    expect(consumed).toEqual([42, "second"]);
  });

  it("wraps duplicate service provision with the provider context", async () => {
    const token = createServiceToken<string>("schema");
    const rejection = await rejectionOf(
      run({
        input,
        plugins: [
          {
            name: "first-provider",
            setup(context) {
              context.provide(token, "first");
            },
          },
          {
            name: "second-provider",
            setup(context) {
              context.provide(token, "second");
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "second-provider", "setup");

    expect(cause).toBeInstanceOf(ServiceRegistryError);
    if (!(cause instanceof ServiceRegistryError)) {
      throw new Error("Expected ServiceRegistryError.");
    }
    expect(cause.code).toBe("duplicate-service");
    expect(cause.serviceName).toBe("schema");
  });

  it("wraps missing service access with the consumer context", async () => {
    const token = createServiceToken<string>("schema");
    const rejection = await rejectionOf(
      run({
        input,
        plugins: [
          {
            name: "consumer",
            build(context) {
              context.get(token);
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "consumer", "build");

    expect(cause).toBeInstanceOf(ServiceRegistryError);
    if (!(cause instanceof ServiceRegistryError)) {
      throw new Error("Expected ServiceRegistryError.");
    }
    expect(cause.code).toBe("missing-service");
  });
});

describe("artifact collection", () => {
  it("collects defensive frozen artifacts and exposes earlier snapshots", async () => {
    const first = {
      path: "types/First.ts",
      contents: "first",
    };
    let observed: readonly GeneratedArtifact[] = [];

    const result = await run({
      input,
      plugins: [
        {
          name: "first",
          build(context) {
            context.emit(first);
            first.path = "mutated.ts";
            first.contents = "mutated";
          },
        },
        {
          name: "second",
          build(context) {
            observed = context.artifacts;
            context.emit({ path: "types/Second.ts", contents: "second" });
          },
        },
      ],
    });

    expect(observed).toEqual([{ path: "types/First.ts", contents: "first" }]);
    expect(Object.isFrozen(observed)).toBe(true);
    expect(Reflect.set(observed, 0, { path: "changed.ts", contents: "changed" })).toBe(false);
    expect(result.artifacts).toEqual([
      { path: "types/First.ts", contents: "first" },
      { path: "types/Second.ts", contents: "second" },
    ]);
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
            build(context) {
              context.emit({ path, contents: "invalid" });
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "invalid-artifact", "build");

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
            build(context) {
              context.emit({ path: "shared.ts", contents: "first" });
            },
          },
          {
            name: "second",
            build(context) {
              context.emit({ path: "shared.ts", contents: "second" });
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "second", "build");

    expect(cause).toBeInstanceOf(ArtifactError);
    if (!(cause instanceof ArtifactError)) {
      throw new Error("Expected ArtifactError.");
    }
    expect(cause.code).toBe("path-collision");
    expect(cause.path).toBe("shared.ts");
  });
});

describe("plugin failures", () => {
  const phases: readonly ("setup" | "build")[] = ["setup", "build"];

  it.each(phases)("retains the %s failure and stops later hooks", async (phase) => {
    const failure = new Error(`${phase} failed`);
    const calls: string[] = [];
    const failingPlugin: OrchestrationPlugin =
      phase === "setup"
        ? {
            name: "failing",
            setup() {
              throw failure;
            },
          }
        : {
            name: "failing",
            build() {
              throw failure;
            },
          };

    const rejection = await rejectionOf(
      run({
        input,
        plugins: [
          failingPlugin,
          {
            name: "later",
            setup() {
              calls.push("later:setup");
            },
            build() {
              calls.push("later:build");
            },
          },
        ],
      }),
    );
    const cause = expectPluginCause(rejection, "failing", phase);

    expect(cause).toBe(failure);
    expect(calls).toEqual(phase === "setup" ? [] : ["later:setup"]);
  });
});
