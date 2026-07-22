import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DiagnosticSeverity } from "@asyncapi/parser";
import { afterEach, describe, expect, it } from "vitest";
import {
  AsyncAPIParseError,
  parseAsyncAPI,
  type AsyncAPIParserOptions,
  type Input,
} from "../src/index.js";

const temporaryDirectories: string[] = [];

const asyncAPIObject = {
  asyncapi: "3.1.0",
  info: {
    title: "Core object input",
    version: "1.0.0",
  },
  channels: {
    events: {
      address: "events",
      messages: {
        Event: {
          payload: {
            type: "object",
            properties: {
              id: { type: "string" },
            },
          },
        },
      },
    },
  },
  operations: {
    sendEvent: {
      action: "send",
      channel: { $ref: "#/channels/events" },
      messages: [{ $ref: "#/channels/events/messages/Event" }],
    },
  },
} satisfies Input;

async function fixture(version: "3.0" | "3.1"): Promise<string> {
  return readFile(new URL(`./fixtures/asyncapi-${version}.yaml`, import.meta.url), "utf8");
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "opalesce-core-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true })),
  );
});

describe("parseAsyncAPI", () => {
  it("parses AsyncAPI 3.0 text and retains non-fatal diagnostics", async () => {
    const result = await parseAsyncAPI(await fixture("3.0"));

    expect(result.document.version()).toBe("3.0.0");
    expect(result.document.channels().has("events")).toBe(true);
    expect(result.document.operations().has("sendEvent")).toBe(true);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "asyncapi-latest-version",
          severity: DiagnosticSeverity.Information,
        }),
      ]),
    );
    expect(Object.isFrozen(result.diagnostics)).toBe(true);

    const firstDiagnostic = result.diagnostics[0];
    expect(firstDiagnostic).toBeDefined();
    expect(Reflect.set(result.diagnostics, result.diagnostics.length, firstDiagnostic)).toBe(false);
  });

  it("parses AsyncAPI 3.1 text with official document methods", async () => {
    const result = await parseAsyncAPI(await fixture("3.1"));

    expect(result.document.version()).toBe("3.1.0");
    expect(result.document.channels().has("events")).toBe(true);
    expect(result.document.operations().has("sendEvent")).toBe(true);
  });

  it("parses JSON text and JavaScript object input", async () => {
    const jsonResult = await parseAsyncAPI(JSON.stringify(asyncAPIObject));
    const objectResult = await parseAsyncAPI(asyncAPIObject);

    expect(jsonResult.document.version()).toBe("3.1.0");
    expect(objectResult.document.version()).toBe("3.1.0");
  });

  it("accepts an existing official AsyncAPI document", async () => {
    const initial = await parseAsyncAPI(await fixture("3.1"));
    const reparsed = await parseAsyncAPI(initial.document);

    expect(reparsed.document).toBe(initial.document);
    expect(reparsed.document.channels().has("events")).toBe(true);
    expect(reparsed.document.operations().has("sendEvent")).toBe(true);
  });

  it("delegates external references to official resolver options", async () => {
    const reads: string[] = [];
    const parserOptions: AsyncAPIParserOptions = {
      __unstable: {
        resolver: {
          resolvers: [
            {
              schema: "memory",
              order: 1,
              read(uri) {
                reads.push(uri.toString());
                return JSON.stringify({
                  type: "object",
                  properties: { id: { type: "string" } },
                });
              },
            },
          ],
        },
      },
    };
    const input: Input = {
      ...asyncAPIObject,
      channels: {
        events: {
          address: "events",
          messages: {
            Event: {
              payload: { $ref: "memory://schemas/Payload" },
            },
          },
        },
      },
    };

    const result = await parseAsyncAPI(input, { parser: parserOptions });

    expect(result.document.version()).toBe("3.1.0");
    expect(reads).toEqual(["memory://schemas/Payload"]);
  });

  it("rejects invalid input with a frozen typed diagnostic error", async () => {
    const rejection = await parseAsyncAPI("asyncapi: 3.1.0").catch((error: unknown) => error);

    expect(rejection).toBeInstanceOf(AsyncAPIParseError);
    if (!(rejection instanceof AsyncAPIParseError)) {
      throw new Error("Expected AsyncAPIParseError.");
    }

    expect(rejection.name).toBe("AsyncAPIParseError");
    expect(rejection.diagnostics.length).toBeGreaterThan(0);
    expect(
      rejection.diagnostics.some((diagnostic) => diagnostic.severity === DiagnosticSeverity.Error),
    ).toBe(true);
    expect(Object.isFrozen(rejection.diagnostics)).toBe(true);
  });

  it("does not interpret a top-level string as a file path", async () => {
    const directory = await temporaryDirectory();
    const path = join(directory, "asyncapi.yaml");
    await writeFile(path, await fixture("3.1"));

    await expect(parseAsyncAPI(path)).rejects.toBeInstanceOf(AsyncAPIParseError);
  });

  it("writes no artifacts for valid or invalid in-memory input", async () => {
    const directory = await temporaryDirectory();
    const source = pathToFileURL(join(directory, "input.yaml")).href;

    await parseAsyncAPI(await fixture("3.1"), { parse: { source } });
    await expect(
      parseAsyncAPI("not an AsyncAPI document", { parse: { source } }),
    ).rejects.toBeInstanceOf(AsyncAPIParseError);

    expect(await readdir(fileURLToPath(new URL("./", source)))).toEqual([]);
  });
});
