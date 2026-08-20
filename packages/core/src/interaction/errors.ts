export type InteractionContractErrorCode =
  | "INTERACTION_IDENTITY_MISSING"
  | "INTERACTION_REFERENCE_UNSUPPORTED"
  | "INTERACTION_VERSION_UNSUPPORTED";

export interface InteractionContractErrorOptions {
  readonly pointer: string;
  readonly details?: Readonly<Record<string, string>>;
}

export class InteractionContractError extends Error {
  readonly code: InteractionContractErrorCode;
  readonly pointer: string;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: InteractionContractErrorCode,
    message: string,
    options: InteractionContractErrorOptions,
  ) {
    super(message);
    this.name = "InteractionContractError";
    this.code = code;
    this.pointer = options.pointer;
    this.details = Object.freeze({ ...options.details });
  }
}
