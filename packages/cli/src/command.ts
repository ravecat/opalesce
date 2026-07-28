import { parseArgs } from "node:util";
import type { Diagnostic } from "@opalesce/core";
import { generate, type GenerateResult } from "./generate.js";

export const ROOT_HELP = `Usage: opalesce <command>

Commands:
  generate [input]  Generate artifacts from an AsyncAPI document

Options:
  -h, --help        Show this help
`;

export const GENERATE_HELP = `Usage: opalesce generate [input] [options]

Arguments:
  input                 Override the input path from the config

Options:
  -c, --config <path>   Use an explicit Opalesce config file
  -o, --out <dir>       Override the output directory
  -h, --help            Show this help
`;

export interface TextWriter {
  write(text: string): void;
}

export interface CommandIO {
  readonly stdout: TextWriter;
  readonly stderr: TextWriter;
}

export interface RunCliOptions {
  readonly cwd?: string;
  readonly io?: CommandIO;
}

interface GenerateArguments {
  readonly configPath?: string;
  readonly input?: string;
  readonly out?: string;
  readonly help: boolean;
}

class CliUsageError extends Error {
  override readonly name = "CliUsageError";
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseRawGenerateArguments(arguments_: readonly string[]) {
  try {
    return parseArgs({
      args: [...arguments_],
      options: {
        config: { type: "string", short: "c" },
        out: { type: "string", short: "o" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    throw new CliUsageError(messageFrom(error), { cause: error });
  }
}

function parseGenerateArguments(arguments_: readonly string[]): GenerateArguments {
  const parsed = parseRawGenerateArguments(arguments_);

  if (parsed.positionals.length > 1) {
    throw new CliUsageError("The generate command accepts at most one input path.");
  }

  const input = parsed.positionals[0];

  return {
    ...(parsed.values.config === undefined ? {} : { configPath: parsed.values.config }),
    ...(input === undefined ? {} : { input }),
    ...(parsed.values.out === undefined ? {} : { out: parsed.values.out }),
    help: parsed.values.help ?? false,
  };
}

function writeLine(writer: TextWriter, text: string): void {
  writer.write(`${text}\n`);
}

function formatDiagnostic(diagnostic: Diagnostic): string {
  const path = diagnostic.path.length === 0 ? "<root>" : diagnostic.path.join(".");

  return `[asyncapi:${String(diagnostic.severity)}] ${path}: ${diagnostic.message}`;
}

function renderSuccess(result: GenerateResult, io: CommandIO): void {
  for (const diagnostic of result.diagnostics) {
    writeLine(io.stderr, formatDiagnostic(diagnostic));
  }

  const noun = result.artifactCount === 1 ? "artifact" : "artifacts";
  writeLine(io.stdout, `Generated ${String(result.artifactCount)} ${noun} -> ${result.outputPath}`);
}

export async function run(
  arguments_: readonly string[],
  options: RunCliOptions = {},
): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const io = options.io ?? {
    stdout: process.stdout,
    stderr: process.stderr,
  };
  const command = arguments_[0];

  if (arguments_.length === 1 && (command === "--help" || command === "-h")) {
    io.stdout.write(ROOT_HELP);
    return 0;
  }

  if (command === undefined) {
    writeLine(io.stderr, "Missing command.");
    io.stderr.write(ROOT_HELP);
    return 2;
  }

  if (command !== "generate") {
    writeLine(io.stderr, `Unknown command "${command}".`);
    io.stderr.write(ROOT_HELP);
    return 2;
  }

  let parsed: GenerateArguments;

  try {
    parsed = parseGenerateArguments(arguments_.slice(1));
  } catch (error) {
    writeLine(io.stderr, messageFrom(error));
    io.stderr.write(GENERATE_HELP);
    return 2;
  }

  if (parsed.help) {
    io.stdout.write(GENERATE_HELP);
    return 0;
  }

  try {
    const result = await generate({
      cwd,
      ...(parsed.configPath === undefined ? {} : { configPath: parsed.configPath }),
      ...(parsed.input === undefined ? {} : { input: parsed.input }),
      ...(parsed.out === undefined ? {} : { out: parsed.out }),
    });

    renderSuccess(result, io);
    return 0;
  } catch (error) {
    writeLine(io.stderr, messageFrom(error));
    return 1;
  }
}
