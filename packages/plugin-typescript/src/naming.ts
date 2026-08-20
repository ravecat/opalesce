import { TypeScriptGenerationError } from "./errors.js";

const RESERVED_FILENAMES = new Set([
  "aux",
  "con",
  "nul",
  "prn",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

export function pascalCase(value: string, pointer: string): string {
  const tokens = value.normalize("NFC").match(/[\p{L}\p{N}]+/gu) ?? [];
  let result = tokens
    .map((token) => `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`)
    .join("");
  if (/^\p{N}/u.test(result)) {
    result = `Type${result}`;
  }
  if (result.length === 0 || !isTypeScriptIdentifier(result)) {
    throw new TypeScriptGenerationError(
      "TYPESCRIPT_NAME_INVALID",
      `The identity at ${pointer} cannot produce a TypeScript symbol.`,
      { pointer, details: { value } },
    );
  }
  return result;
}

export function isTypeScriptIdentifier(value: string): boolean {
  return /^[$_\p{ID_Start}](?:[$_\p{ID_Continue}]|\u200C|\u200D)*$/u.test(value);
}

export function portableFilenameKey(filename: string): string {
  return filename.normalize("NFC").toLowerCase();
}

export function assertPortableFilename(filename: string, pointer: string): void {
  const basename = filename.replace(/\.ts$/u, "");
  if (RESERVED_FILENAMES.has(portableFilenameKey(basename))) {
    throw new TypeScriptGenerationError(
      "TYPESCRIPT_FILENAME_COLLISION",
      `The filename ${filename} is reserved on portable filesystems.`,
      { pointer, details: { filename } },
    );
  }
}
