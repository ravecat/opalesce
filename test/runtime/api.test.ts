import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import * as runtime from "~/index";
import * as plugins from "~/plugins";

describe("public API", () => {
  test("root entrypoint only exposes runtime helpers", () => {
    expect(Object.keys(runtime).sort()).toEqual(["defineConfig", "generate"]);
    expect(runtime).not.toHaveProperty("asyncapi");
    expect(runtime).not.toHaveProperty("typescript");
    expect(runtime).not.toHaveProperty("zod");
  });

  test("plugins entrypoint exposes built-in plugins", () => {
    expect(Object.keys(plugins).sort()).toEqual(["asyncapi", "typescript", "zod"]);
  });

  test("package exports expose the grouped plugins barrel", async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(process.cwd(), "package.json"), "utf8"),
    ) as {
      exports: Record<string, string>;
    };

    expect(packageJson.exports).toMatchObject({
      ".": "./dist/index.js",
      "./plugins": "./dist/plugins/index.js",
      "./plugins/asyncapi": "./dist/plugins/asyncapi.js",
      "./plugins/typescript": "./dist/plugins/typescript.js",
      "./plugins/zod": "./dist/plugins/zod.js",
    });
  });
});
