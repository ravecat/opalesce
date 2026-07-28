import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(packageJson.name, "@opalesce/cli");
assert.equal(packageJson.private, true);
assert.equal(packageJson.type, "module");
assert.equal(packageJson.bin.opalesce, "./bin/opalesce.js");
assert.equal(packageJson.main, "./dist/index.js");
assert.equal(packageJson.types, "./dist/index.d.ts");
assert.equal(packageJson.exports["."].import, "./dist/index.js");
assert.equal(packageJson.exports["."].types, "./dist/index.d.ts");
assert.equal(packageJson.dependencies["@opalesce/config"], "workspace:*");
assert.equal(packageJson.dependencies["@opalesce/core"], "workspace:*");
assert.deepEqual(Object.keys(packageJson.dependencies), ["@opalesce/config", "@opalesce/core"]);

const binEntry = new URL("../dist/bin.js", import.meta.url);
const binShim = new URL("../bin/opalesce.js", import.meta.url);
const commandEntry = new URL("../dist/command.js", import.meta.url);
const runtimeEntry = new URL("../dist/index.js", import.meta.url);
const declarationEntry = new URL("../dist/index.d.ts", import.meta.url);

await Promise.all([
  access(binEntry),
  access(binShim),
  access(commandEntry),
  access(runtimeEntry),
  access(declarationEntry),
]);

const binSource = await readFile(binEntry, "utf8");
const binShimSource = await readFile(binShim, "utf8");
const commandSource = await readFile(commandEntry, "utf8");
const declarationSource = await readFile(declarationEntry, "utf8");
const runtime = await import(runtimeEntry.href);

assert.match(binSource, /^#!\/usr\/bin\/env node\n/u);
assert.match(binShimSource, /^#!\/usr\/bin\/env node\n/u);
assert.match(binShimSource, /import "\.\.\/dist\/bin\.js";/u);
assert.doesNotMatch(binSource, /(?:\.\.\/)+src\//u);
assert.doesNotMatch(commandSource, /(?:\.\.\/)+src\//u);
assert.deepEqual(Object.keys(runtime), ["run"]);
assert.match(declarationSource, /CommandIO/u);
assert.match(declarationSource, /RunCliOptions/u);
assert.match(declarationSource, /TextWriter/u);

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
