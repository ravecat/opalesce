import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(packageJson.name, "opalesce");
assert.equal(packageJson.private, true);
assert.equal(packageJson.type, "module");
assert.equal(packageJson.main, "./dist/index.js");
assert.equal(packageJson.types, "./dist/index.d.ts");
assert.equal(packageJson.bin.opalesce, "./bin/opalesce.js");
assert.deepEqual(packageJson.exports, {
  ".": {
    types: "./dist/index.d.ts",
    import: "./dist/index.js",
  },
  "./config": {
    types: "./dist/config.d.ts",
    import: "./dist/config.js",
  },
});
assert.deepEqual(packageJson.dependencies, {
  "@opalesce/cli": "workspace:*",
  "@opalesce/config": "workspace:*",
  "@opalesce/core": "workspace:*",
});

const binEntry = new URL("../dist/bin.js", import.meta.url);
const binShim = new URL("../bin/opalesce.js", import.meta.url);
const rootEntry = new URL("../dist/index.js", import.meta.url);
const rootDeclaration = new URL("../dist/index.d.ts", import.meta.url);
const configEntry = new URL("../dist/config.js", import.meta.url);
const configDeclaration = new URL("../dist/config.d.ts", import.meta.url);

await Promise.all([
  access(binEntry),
  access(binShim),
  access(rootEntry),
  access(rootDeclaration),
  access(configEntry),
  access(configDeclaration),
]);

const [binSource, binShimSource, rootSource, rootDeclarationSource, configDeclarationSource] =
  await Promise.all([
    readFile(binEntry, "utf8"),
    readFile(binShim, "utf8"),
    readFile(rootEntry, "utf8"),
    readFile(rootDeclaration, "utf8"),
    readFile(configDeclaration, "utf8"),
  ]);
const [rootRuntime, configRuntime] = await Promise.all([
  import(rootEntry.href),
  import(configEntry.href),
]);

assert.deepEqual(Object.keys(rootRuntime).sort(), [
  "ArtifactError",
  "PluginConfigurationError",
  "PluginExecutionError",
  "ServiceRegistryError",
  "createServiceToken",
  "defineConfig",
  "definePipelineConfig",
  "definePlugin",
  "run",
]);
assert.deepEqual(Object.keys(configRuntime), ["defineConfig"]);
assert.equal(rootRuntime.defineConfig, configRuntime.defineConfig);
assert.equal("runPipeline" in rootRuntime, false);

assert.match(binSource, /^#!\/usr\/bin\/env node\n/u);
assert.match(binSource, /import \{ run \} from "@opalesce\/cli";/u);
assert.match(binShimSource, /^#!\/usr\/bin\/env node\n/u);
assert.match(binShimSource, /import "\.\.\/dist\/bin\.js";/u);
assert.doesNotMatch(rootSource, /(?:\.\.\/)+src\//u);
assert.match(rootDeclarationSource, /definePipelineConfig/u);
assert.match(rootDeclarationSource, /run/u);
assert.doesNotMatch(rootDeclarationSource, /runPipeline/u);
assert.match(rootDeclarationSource, /OpalesceConfig/u);
assert.match(configDeclarationSource, /OutputConfig/u);

const binPath = fileURLToPath(binShim);
const help = spawnSync(process.execPath, [binPath, "--help"], {
  encoding: "utf8",
});
const unknown = spawnSync(process.execPath, [binPath, "unknown"], {
  encoding: "utf8",
});

assert.equal(help.status, 0);
assert.match(help.stdout, /Usage: opalesce <command>/u);
assert.equal(unknown.status, 2);
assert.match(unknown.stderr, /Unknown command "unknown"/u);
