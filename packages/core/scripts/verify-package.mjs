import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { URL } from "node:url";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

assert.equal(packageJson.name, "@opalesce/core");
assert.equal(packageJson.private, true);
assert.equal(packageJson.type, "module");
assert.equal(packageJson.main, "./dist/index.js");
assert.equal(packageJson.types, "./dist/index.d.ts");
assert.equal(packageJson.exports["."].import, "./dist/index.js");
assert.equal(packageJson.exports["."].types, "./dist/index.d.ts");
assert.equal(packageJson.dependencies["@asyncapi/parser"], "^3.6.0");
assert.deepEqual(Object.keys(packageJson.dependencies), ["@asyncapi/parser"]);

const runtimeEntry = new URL("../dist/index.js", import.meta.url);
const declarationEntry = new URL("../dist/index.d.ts", import.meta.url);

await Promise.all([access(runtimeEntry), access(declarationEntry)]);

const runtime = await import(runtimeEntry.href);

assert.deepEqual(Object.keys(runtime).sort(), ["AsyncAPIParseError", "parseAsyncAPI"]);

const runtimeSource = await readFile(runtimeEntry, "utf8");
const declarationSource = await readFile(declarationEntry, "utf8");

assert.doesNotMatch(runtimeSource, /(?:\.\.\/)+src\//u);
assert.match(declarationSource, /AsyncAPIDocumentInterface/u);
assert.match(declarationSource, /AsyncAPIParserOptions/u);
assert.match(declarationSource, /ParseAsyncAPIOptions/u);
assert.match(declarationSource, /ParsedAsyncAPI/u);
