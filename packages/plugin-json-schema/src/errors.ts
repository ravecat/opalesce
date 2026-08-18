import type { JsonObject } from "@opalesce/core";

export type JsonSchemaGenerationErrorCode =
  | "COMPONENT_NAME_COLLISION"
  | "DIALECT_CONFLICT"
  | "DUPLICATE_SCHEMA_ID"
  | "INVALID_COMPONENT_NAME"
  | "INVALID_JSON_SCHEMA"
  | "INVALID_SCHEMA_ID"
  | "SOURCE_UNAVAILABLE"
  | "UNRESOLVED_REFERENCE"
  | "UNSUPPORTED_ASYNCAPI_VERSION"
  | "UNSUPPORTED_REFERENCE"
  | "UNSUPPORTED_SCHEMA_FORMAT";

export interface JsonSchemaGenerationErrorOptions {
  readonly sourcePointer: string;
  readonly details?: JsonObject;
}

export class JsonSchemaGenerationError extends Error {
  override readonly name = "JsonSchemaGenerationError";
  readonly code: JsonSchemaGenerationErrorCode;
  readonly sourcePointer: string;
  readonly details?: JsonObject;

  constructor(
    code: JsonSchemaGenerationErrorCode,
    message: string,
    options: JsonSchemaGenerationErrorOptions,
  ) {
    super(message);
    this.code = code;
    this.sourcePointer = options.sourcePointer;
    if (options.details !== undefined) {
      this.details = Object.freeze({ ...options.details });
    }
  }
}
