#!/usr/bin/env node
import { parseArgs } from "node:util";
import { generate } from "~/generate";

interface CliValues {
  config?: string;
  input?: string;
  out?: string;
  help?: boolean;
}

const HELP = `
Usage: asyncapi-codegen [--config <path-to-config>] [--input <path-to-asyncapi.{yaml|json}>] [--out <output-dir>]

Options:
  -c, --config <path> Path to config file. If omitted, asyncapi-codegen.config.{mjs,js,cjs} is resolved from cwd.
  -i, --input <path>  Override config.input.path.
  -o, --out <dir>     Override config.output.path.
  -h, --help          Show this help message.

Examples:
  asyncapi-codegen
  asyncapi-codegen --config ./asyncapi-codegen.config.mjs
  asyncapi-codegen --config ./asyncapi-codegen.config.mjs --input ./specs/asyncapi.yaml --out ./generated
`;

function printDiagnostics(diagnostics: unknown[]): void {
  for (const diagnostic of diagnostics) {
    if (!diagnostic || typeof diagnostic !== "object") {
      console.log(`[asyncapi] ${String(diagnostic)}`);
      continue;
    }

    const value = diagnostic as {
      path?: unknown;
      severity?: unknown;
      message?: unknown;
    };

    const path =
      Array.isArray(value.path) && value.path.length > 0
        ? value.path.join(".")
        : "<root>";
    const severity =
      typeof value.severity === "string" || typeof value.severity === "number"
        ? String(value.severity)
        : "info";
    const message =
      typeof value.message === "string" ? value.message : String(diagnostic);

    console.log(`[asyncapi:${severity}] ${path}: ${message}`);
  }
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  let values: CliValues;

  try {
    ({ values } = parseArgs({
      args,
      options: {
        config: { type: "string", short: "c" },
        input: { type: "string", short: "i" },
        out: { type: "string", short: "o" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}\n\n${HELP}`);
  }

  if (values.help) {
    console.log(HELP);
    return;
  }

  const result = await generate({
    config: values.config,
    input: values.input,
    out: values.out,
  });

  printDiagnostics(result.diagnostics);
  console.log(`Generated ${result.total} artifacts -> ${result.outDir}`);
}

runCli().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
