export type TypeScriptGenerationErrorCode =
  | "TYPESCRIPT_FILENAME_COLLISION"
  | "TYPESCRIPT_FORMAT_UNSUPPORTED"
  | "TYPESCRIPT_NAME_INVALID"
  | "TYPESCRIPT_SCHEMA_UNSUPPORTED"
  | "TYPESCRIPT_SYMBOL_COLLISION"
  | "TYPESCRIPT_SYNTAX_INVALID";

export interface TypeScriptGenerationErrorOptions {
  readonly pointer: string;
  readonly details?: Readonly<Record<string, string>>;
}

export class TypeScriptGenerationError extends Error {
  readonly code: TypeScriptGenerationErrorCode;
  readonly pointer: string;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: TypeScriptGenerationErrorCode,
    message: string,
    options: TypeScriptGenerationErrorOptions,
  ) {
    super(message);
    this.name = "TypeScriptGenerationError";
    this.code = code;
    this.pointer = options.pointer;
    this.details = Object.freeze({ ...options.details });
  }
}
