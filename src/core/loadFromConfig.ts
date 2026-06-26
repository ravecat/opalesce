import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DiagnosticSeverity, Parser } from "@asyncapi/parser";
import type { UserConfig } from "~/types";
import { AsyncApiDocument } from "~/core/AsyncApiDocument";

export async function loadFromConfig({
  cwd,
  input,
}: {
  cwd: string;
  input: UserConfig["input"];
}): Promise<AsyncApiDocument> {
  const parser = new Parser();
  const source = readFileSync(resolve(cwd, input.path), "utf8");
  const { document, diagnostics } = await parser.parse(source);
  const fatalDiagnostics = diagnostics.filter(
    (diagnostic) => diagnostic.severity === DiagnosticSeverity.Error,
  );

  if (!document || fatalDiagnostics.length > 0) {
    throw new Error(`AsyncAPI parse failed with ${fatalDiagnostics.length} error(s).`);
  }

  return new AsyncApiDocument(document, { diagnostics });
}
