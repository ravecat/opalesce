import type { JsonArray, JsonObject, JsonValue } from "@opalesce/core";
import Ajv, { type AnySchema, type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import {
  DRAFT_07_URI,
  escapePointerToken,
  type BuiltComponent,
  type BuiltOutput,
} from "./output.js";
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
const VALIDATION_ROOT = "https://opalesce.invalid/generated/";

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

function configuredAjv(extensionKeywords: ReadonlySet<string>): Ajv {
  const ajv = new Ajv({ allErrors: true, strict: true, validateSchema: true });
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

function componentUri(component: BuiltComponent): string {
  return new URL(encodeURIComponent(component.filename), VALIDATION_ROOT).href;
}

function validationFailure(
  message: string,
  sourcePointer: string,
  cause: unknown,
): JsonSchemaGenerationError {
  const causeMessage = cause instanceof Error ? cause.message : "Unknown Ajv compilation error.";
  return new JsonSchemaGenerationError("INVALID_JSON_SCHEMA", message, {
    sourcePointer,
    details: errorDetails({ message: causeMessage }),
  });
}

function validateDocument(ajv: Ajv, component: BuiltComponent): void {
  try {
    if (ajv.validateSchema(component.document as AnySchema)) {
      return;
    }
  } catch (cause) {
    throw validationFailure(
      `Generated JSON Schema component "${component.name}" cannot be validated.`,
      component.source.schemaPointer,
      cause,
    );
  }

  const firstError = ajv.errors?.[0];
  throw new JsonSchemaGenerationError(
    "INVALID_JSON_SCHEMA",
    `Generated JSON Schema component "${component.name}" does not conform to Draft 07.`,
    {
      sourcePointer: `${component.source.schemaPointer}${firstError?.instancePath ?? ""}`,
      details: errorDetails({ errors: ajvErrors(ajv.errors) }),
    },
  );
}

export function validateOutput(output: BuiltOutput): void {
  const ajv = configuredAjv(output.extensionKeywords);

  for (const component of output.components) {
    validateDocument(ajv, component);
  }
  if (!ajv.validateSchema(output.index)) {
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "Generated JSON Schema index does not conform to Draft 07.",
      { sourcePointer: "", details: errorDetails({ errors: ajvErrors(ajv.errors) }) },
    );
  }

  for (const component of output.components) {
    try {
      ajv.addSchema(component.document as AnySchema, componentUri(component));
    } catch (cause) {
      throw validationFailure(
        `Generated JSON Schema component "${component.name}" cannot be registered.`,
        component.source.schemaPointer,
        cause,
      );
    }
  }

  const indexUri = new URL("index.schema.json", VALIDATION_ROOT).href;
  try {
    ajv.addSchema(output.index, indexUri);
  } catch (cause) {
    throw validationFailure("Generated JSON Schema index cannot be registered.", "", cause);
  }

  for (const component of output.components) {
    try {
      ajv.compile({ $schema: DRAFT_07_URI, $ref: componentUri(component) });
      ajv.compile({
        $schema: DRAFT_07_URI,
        $ref: `${indexUri}#/definitions/${escapePointerToken(component.name)}`,
      });
    } catch (cause) {
      throw validationFailure(
        `Generated JSON Schema component "${component.name}" cannot be compiled.`,
        component.source.schemaPointer,
        cause,
      );
    }
  }
}
