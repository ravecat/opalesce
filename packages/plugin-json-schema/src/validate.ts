import type { JsonArray, JsonObject, JsonValue } from "@opalesce/core";
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import { DRAFT_07_URI, escapePointerToken, type BuiltBundle } from "./bundle.js";
import { JsonSchemaGenerationError } from "./errors.js";

const ASYNCAPI_ANNOTATION_KEYWORDS: readonly string[] = ["discriminator", "externalDocs"];
const ASYNCAPI_FORMATS: readonly string[] = [
  "binary",
  "byte",
  "double",
  "float",
  "int32",
  "int64",
  "password",
];

function errorDetails(values: Record<string, JsonValue>): JsonObject {
  return Object.freeze(values);
}

function ajvErrors(errors: readonly ErrorObject[] | null | undefined): JsonArray {
  return (errors ?? []).map((error) => {
    const value: Record<string, JsonValue> = {
      instancePath: error.instancePath,
      keyword: error.keyword,
      schemaPath: error.schemaPath,
    };
    if (error.message !== undefined) {
      value.message = error.message;
    }
    return value;
  });
}

function sourcePointerForBundlePath(bundle: BuiltBundle, instancePath: string): string {
  const match = /^\/definitions\/([^/]+)(.*)$/.exec(instancePath);
  if (match === null) {
    return "";
  }

  const encodedName = match[1];
  if (encodedName === undefined) {
    return "";
  }

  const name = encodedName.replaceAll("~1", "/").replaceAll("~0", "~");
  const source = bundle.definitionSources.get(name);
  return source === undefined ? "" : `${source.schemaPointer}${match[2] ?? ""}`;
}

function configuredAjv(extensionKeywords: ReadonlySet<string>): Ajv {
  const ajv = new Ajv({
    allErrors: true,
    strict: true,
    validateSchema: true,
  });
  addFormats(ajv);

  const draft07MetaSchema = ajv.getSchema(DRAFT_07_URI)?.schema;
  if (
    typeof draft07MetaSchema !== "object" ||
    draft07MetaSchema === null ||
    Array.isArray(draft07MetaSchema)
  ) {
    throw new Error("Ajv Draft 07 meta-schema is unavailable.");
  }
  ajv.addMetaSchema(draft07MetaSchema, "https://json-schema.org/draft-07/schema#");

  for (const keyword of [...ASYNCAPI_ANNOTATION_KEYWORDS, ...extensionKeywords]) {
    if (!ajv.getKeyword(keyword)) {
      ajv.addKeyword({ keyword, valid: true });
    }
  }

  for (const format of ASYNCAPI_FORMATS) {
    ajv.addFormat(format, true);
  }

  return ajv;
}

export function validateBundle(bundle: BuiltBundle): void {
  const ajv = configuredAjv(bundle.extensionKeywords);

  if (!ajv.validateSchema(bundle.document)) {
    const errors = ajvErrors(ajv.errors);
    const firstError = ajv.errors?.[0];
    const sourcePointer = sourcePointerForBundlePath(bundle, firstError?.instancePath ?? "");
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "Generated JSON Schema bundle does not conform to Draft 07.",
      {
        sourcePointer,
        details: errorDetails({ errors }),
      },
    );
  }

  try {
    ajv.addSchema(bundle.document, bundle.validationUri);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Unknown Ajv compilation error.";
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "Generated JSON Schema bundle cannot be registered.",
      {
        sourcePointer: "",
        details: errorDetails({ message }),
      },
    );
  }

  const definitions = bundle.document.definitions;
  if (typeof definitions !== "object" || definitions === null || Array.isArray(definitions)) {
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "Generated bundle definitions must be an object.",
      { sourcePointer: "" },
    );
  }

  for (const name of Object.keys(definitions)) {
    try {
      ajv.compile({
        $schema: DRAFT_07_URI,
        $ref: `${bundle.validationUri}#/definitions/${escapePointerToken(name)}`,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown Ajv compilation error.";
      const sourcePointer = bundle.definitionSources.get(name)?.schemaPointer ?? "";
      throw new JsonSchemaGenerationError(
        "INVALID_JSON_SCHEMA",
        `Generated JSON Schema definition "${name}" cannot be compiled.`,
        {
          sourcePointer,
          details: errorDetails({ message }),
        },
      );
    }
  }
}
