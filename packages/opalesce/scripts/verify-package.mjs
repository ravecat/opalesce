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
  "./orchestrator": {
    types: "./dist/orchestrator.d.ts",
    import: "./dist/orchestrator.js",
  },
});
assert.deepEqual(packageJson.dependencies, {
  "@opalesce/cli": "workspace:*",
  "@opalesce/config": "workspace:*",
  "@opalesce/orchestrator": "workspace:*",
});

const binEntry = new URL("../dist/bin.js", import.meta.url);
const binShim = new URL("../bin/opalesce.js", import.meta.url);
const rootEntry = new URL("../dist/index.js", import.meta.url);
const rootDeclaration = new URL("../dist/index.d.ts", import.meta.url);
const configEntry = new URL("../dist/config.js", import.meta.url);
const configDeclaration = new URL("../dist/config.d.ts", import.meta.url);
const orchestratorEntry = new URL("../dist/orchestrator.js", import.meta.url);
const orchestratorDeclaration = new URL("../dist/orchestrator.d.ts", import.meta.url);

await Promise.all([
  access(binEntry),
  access(binShim),
  access(rootEntry),
  access(rootDeclaration),
  access(configEntry),
  access(configDeclaration),
  access(orchestratorEntry),
  access(orchestratorDeclaration),
]);

const [
  binSource,
  binShimSource,
  rootSource,
  rootDeclarationSource,
  configDeclarationSource,
  orchestratorDeclarationSource,
] = await Promise.all([
  readFile(binEntry, "utf8"),
  readFile(binShim, "utf8"),
  readFile(rootEntry, "utf8"),
  readFile(rootDeclaration, "utf8"),
  readFile(configDeclaration, "utf8"),
  readFile(orchestratorDeclaration, "utf8"),
]);
const [rootRuntime, configRuntime, orchestratorRuntime] = await Promise.all([
  import(rootEntry.href),
  import(configEntry.href),
  import(orchestratorEntry.href),
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
  "runPipeline",
]);
assert.deepEqual(Object.keys(configRuntime), ["defineConfig"]);
assert.deepEqual(Object.keys(orchestratorRuntime).sort(), [
  "ArtifactError",
  "PluginConfigurationError",
  "PluginExecutionError",
  "ServiceRegistryError",
  "createServiceToken",
  "defineConfig",
  "definePlugin",
  "runPipeline",
]);
assert.equal(rootRuntime.defineConfig, configRuntime.defineConfig);
assert.equal(rootRuntime.definePipelineConfig, orchestratorRuntime.defineConfig);
assert.equal(rootRuntime.definePlugin, orchestratorRuntime.definePlugin);
assert.equal(rootRuntime.runPipeline, orchestratorRuntime.runPipeline);

assert.match(binSource, /^#!\/usr\/bin\/env node\n/u);
assert.match(binSource, /import \{ runCli \} from "@opalesce\/cli";/u);
assert.match(binShimSource, /^#!\/usr\/bin\/env node\n/u);
assert.match(binShimSource, /import "\.\.\/dist\/bin\.js";/u);
assert.doesNotMatch(rootSource, /(?:\.\.\/)+src\//u);
assert.match(rootDeclarationSource, /definePipelineConfig/u);
assert.match(rootDeclarationSource, /OpalesceConfig/u);
assert.match(configDeclarationSource, /OutputConfig/u);
assert.match(orchestratorDeclarationSource, /PipelineResult/u);

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
