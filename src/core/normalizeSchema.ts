const PARSER_PRIVATE_KEYS = new Set(["x-parser-schema-id", "x-parser-unique-object-id"]);

function stripParserMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripParserMetadata(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, nested]) => !PARSER_PRIVATE_KEYS.has(key) && nested !== undefined)
        .map(([key, nested]) => [key, stripParserMetadata(nested)]),
    );
  }

  return value;
}

export async function normalizeSchema({
  schemaModel,
  schemaFormat,
  name,
}: {
  schemaModel: { json(): unknown; schemaFormat?(): string | undefined };
  schemaFormat?: string;
  name: string;
}): Promise<unknown> {
  const resolvedSchemaFormat =
    schemaFormat ??
    (typeof schemaModel.schemaFormat === "function" ? schemaModel.schemaFormat() : undefined);

  if (
    resolvedSchemaFormat &&
    !resolvedSchemaFormat.startsWith("application/vnd.aai.asyncapi") &&
    !resolvedSchemaFormat.startsWith("application/schema+json") &&
    !resolvedSchemaFormat.startsWith("application/json")
  ) {
    throw new Error(
      `Unsupported schemaFormat for ${name}: ${resolvedSchemaFormat}. v1 only supports AsyncAPI and JSON Schema compatible payloads.`,
    );
  }

  return stripParserMetadata(schemaModel.json());
}
