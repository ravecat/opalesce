import type { AsyncAPISource, JsonObject, JsonValue } from "@opalesce/core";
import { JsonSchemaGenerationError } from "./errors.js";

export const DRAFT_07_URI = "http://json-schema.org/draft-07/schema#";

const LOCAL_COMPONENT_PREFIX = "#/components/schemas/";
const SUPPORTED_VERSION = /^(?:2\.6|3\.0|3\.1)\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const INVALID_FILENAME_CHARACTER = /[<>:"/\\|?*]/u;
const RESERVED_DEVICE_NAME = /^(?:AUX|CON|NUL|PRN|COM[1-9]|LPT[1-9])$/iu;
const SCHEMA_MAP_KEYWORDS: readonly string[] = ["definitions", "patternProperties", "properties"];
const SCHEMA_VALUE_KEYWORDS: readonly string[] = [
  "additionalItems",
  "additionalProperties",
  "contains",
  "else",
  "if",
  "not",
  "propertyNames",
  "then",
];
const SCHEMA_ARRAY_KEYWORDS: readonly string[] = ["allOf", "anyOf", "oneOf"];

type MutableJsonObject = Record<string, JsonValue>;
type MutableSchema = MutableJsonObject | boolean;

export interface ComponentSource {
  readonly componentPointer: string;
  readonly schemaPointer: string;
}

export interface BuiltComponent {
  readonly name: string;
  readonly filename: string;
  readonly document: JsonObject | boolean;
  readonly source: ComponentSource;
}

export interface BuiltOutput {
  readonly index: JsonObject;
  readonly components: readonly BuiltComponent[];
  readonly extensionKeywords: ReadonlySet<string>;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function errorDetails(values: Record<string, JsonValue>): JsonObject {
  return Object.freeze(values);
}

export function escapePointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function decodePointerToken(value: string): string | undefined {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "~") {
      result += character;
      continue;
    }

    const escaped = value[index + 1];
    if (escaped === "0") {
      result += "~";
    } else if (escaped === "1") {
      result += "/";
    } else {
      return undefined;
    }
    index += 1;
  }

  return result;
}

function isJsonObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMutableSchema(value: JsonValue | undefined): value is MutableSchema {
  return typeof value === "boolean" || isJsonObject(value);
}

function copyValue(value: JsonValue, extensions: Set<string>): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => copyValue(item, extensions));
  }

  if (!isJsonObject(value)) {
    return value;
  }

  const entries: Array<readonly [string, JsonValue]> = [];
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith("x-parser-")) {
      continue;
    }
    if (key.startsWith("x-")) {
      extensions.add(key);
    }
    entries.push([key, copyValue(child, extensions)]);
  }
  return Object.fromEntries(entries);
}

function isDraft07Dialect(value: string): boolean {
  return /^(?:http|https):\/\/json-schema\.org\/draft-07\/schema#?$/u.test(value);
}

function isDraft07Format(value: string): boolean {
  return value.toLowerCase().replaceAll(/\s+/gu, "") === "application/schema+json;version=draft-07";
}

function schemaChildren(
  schema: MutableJsonObject,
  pointer: string,
): readonly (readonly [MutableSchema, string])[] {
  const children: Array<readonly [MutableSchema, string]> = [];

  for (const keyword of SCHEMA_MAP_KEYWORDS) {
    const schemas = schema[keyword];
    if (!isJsonObject(schemas)) {
      continue;
    }
    for (const [key, child] of Object.entries(schemas)) {
      if (isMutableSchema(child)) {
        children.push([child, `${pointer}/${keyword}/${escapePointerToken(key)}`]);
      }
    }
  }

  for (const keyword of SCHEMA_VALUE_KEYWORDS) {
    const child = schema[keyword];
    if (isMutableSchema(child)) {
      children.push([child, `${pointer}/${keyword}`]);
    }
  }

  for (const keyword of SCHEMA_ARRAY_KEYWORDS) {
    const schemas = schema[keyword];
    if (!Array.isArray(schemas)) {
      continue;
    }
    schemas.forEach((child, index) => {
      if (isMutableSchema(child)) {
        children.push([child, `${pointer}/${keyword}/${index}`]);
      }
    });
  }

  const items = schema.items;
  if (Array.isArray(items)) {
    items.forEach((child, index) => {
      if (isMutableSchema(child)) {
        children.push([child, `${pointer}/items/${index}`]);
      }
    });
  } else if (isMutableSchema(items)) {
    children.push([items, `${pointer}/items`]);
  }

  const dependencies = schema.dependencies;
  if (isJsonObject(dependencies)) {
    for (const [key, child] of Object.entries(dependencies)) {
      if (isMutableSchema(child)) {
        children.push([child, `${pointer}/dependencies/${escapePointerToken(key)}`]);
      }
    }
  }

  return children;
}

function validateDialect(schema: MutableSchema, schemaPointer: string, root: boolean): void {
  if (typeof schema === "boolean") {
    return;
  }

  const dialect = schema.$schema;
  if (dialect !== undefined) {
    const dialectPointer = `${schemaPointer}/$schema`;
    if (!root || typeof dialect !== "string" || !isDraft07Dialect(dialect)) {
      throw new JsonSchemaGenerationError(
        "DIALECT_CONFLICT",
        root
          ? `Schema at "${schemaPointer}" does not declare JSON Schema Draft 07.`
          : `Schema dialect declaration at "${dialectPointer}" is not allowed in a subschema.`,
        {
          sourcePointer: dialectPointer,
          details: errorDetails({
            dialect: typeof dialect === "string" ? dialect : "<non-string>",
            dialectPointer,
          }),
        },
      );
    }
  }

  for (const [child, childPointer] of schemaChildren(schema, schemaPointer)) {
    validateDialect(child, childPointer, false);
  }
}

function resolvedIdentifier(
  identifier: JsonValue,
  inheritedBase: string | undefined,
  pointer: string,
): string {
  if (typeof identifier !== "string") {
    throw new JsonSchemaGenerationError(
      "INVALID_SCHEMA_ID",
      `Schema identifier at "${pointer}" must be a URI-reference string.`,
      {
        sourcePointer: pointer,
        details: errorDetails({ identifier: "<non-string>" }),
      },
    );
  }

  try {
    return new URL(identifier, inheritedBase).href;
  } catch {
    throw new JsonSchemaGenerationError(
      "INVALID_SCHEMA_ID",
      `Schema identifier "${identifier}" requires an absolute authored base URI.`,
      {
        sourcePointer: pointer,
        details: errorDetails({ identifier }),
      },
    );
  }
}

function indexSchemaResources(
  schema: MutableSchema,
  pointer: string,
  inheritedBase: string | undefined,
  identifiers: Map<string, string>,
  scopes: Map<MutableJsonObject, string | undefined>,
): void {
  if (typeof schema === "boolean") {
    return;
  }

  let currentBase = inheritedBase;
  if (schema.$id !== undefined) {
    const identifierPointer = `${pointer}/$id`;
    currentBase = resolvedIdentifier(schema.$id, inheritedBase, identifierPointer);
    const previousPointer = identifiers.get(currentBase);
    if (previousPointer !== undefined) {
      throw new JsonSchemaGenerationError(
        "DUPLICATE_SCHEMA_ID",
        `Schema identifier "${currentBase}" is declared more than once.`,
        {
          sourcePointer: identifierPointer,
          details: errorDetails({
            identifier: currentBase,
            firstSourcePointer: previousPointer,
            secondSourcePointer: identifierPointer,
          }),
        },
      );
    }
    identifiers.set(currentBase, identifierPointer);
  }

  scopes.set(schema, currentBase);
  for (const [child, childPointer] of schemaChildren(schema, pointer)) {
    indexSchemaResources(child, childPointer, currentBase, identifiers, scopes);
  }
}

function resourceUri(value: string): string {
  const url = new URL(value);
  url.hash = "";
  return url.href;
}

function hasInvalidFilenameCharacter(value: string): boolean {
  return (
    INVALID_FILENAME_CHARACTER.test(value) ||
    [...value].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
    })
  );
}

function componentFilename(name: string, sourcePointer: string): string {
  const filename = `${name}.schema.json`;
  const deviceStem = name.split(".", 1)[0] ?? name;
  if (
    name.length === 0 ||
    name === "." ||
    name === ".." ||
    hasInvalidFilenameCharacter(name) ||
    /[. ]$/u.test(name) ||
    RESERVED_DEVICE_NAME.test(deviceStem)
  ) {
    throw new JsonSchemaGenerationError(
      "INVALID_COMPONENT_NAME",
      `Component name "${name}" cannot be used as a portable artifact filename.`,
      {
        sourcePointer,
        details: errorDetails({ componentName: name, filename }),
      },
    );
  }
  return filename;
}

function encodedFilename(filename: string): string {
  return encodeURIComponent(filename);
}

function rewriteComponentReference(
  reference: string,
  pointer: string,
  filenames: ReadonlyMap<string, string>,
  currentBase: string | undefined,
): string {
  const remainder = reference.slice(LOCAL_COMPONENT_PREFIX.length);
  const slash = remainder.indexOf("/");
  const encodedComponent = slash === -1 ? remainder : remainder.slice(0, slash);
  const component = decodePointerToken(encodedComponent);
  const filename = component === undefined ? undefined : filenames.get(component);

  if (component === undefined || filename === undefined) {
    throw new JsonSchemaGenerationError(
      "UNRESOLVED_REFERENCE",
      `Component schema reference "${reference}" does not resolve.`,
      {
        sourcePointer: pointer,
        details: errorDetails({ reference }),
      },
    );
  }

  if (currentBase !== undefined) {
    throw new JsonSchemaGenerationError(
      "UNSUPPORTED_REFERENCE",
      `Component schema reference "${reference}" cannot be rewritten safely under an authored $id.`,
      {
        sourcePointer: pointer,
        details: errorDetails({ reference, reason: "identifier-scoped-component-reference" }),
      },
    );
  }

  const suffix = slash === -1 ? "" : remainder.slice(slash);
  return `./${encodedFilename(filename)}${suffix.length === 0 ? "" : `#${suffix}`}`;
}

function rewriteSchemaReferences(
  schema: MutableSchema,
  pointer: string,
  filenames: ReadonlyMap<string, string>,
  embeddedResources: ReadonlySet<string>,
  scopes: ReadonlyMap<MutableJsonObject, string | undefined>,
): void {
  if (typeof schema === "boolean") {
    return;
  }

  const currentBase = scopes.get(schema);
  const reference = schema.$ref;
  if (reference !== undefined) {
    const referencePointer = `${pointer}/$ref`;
    if (typeof reference !== "string") {
      throw new JsonSchemaGenerationError(
        "INVALID_JSON_SCHEMA",
        `Schema reference at "${referencePointer}" must be a string.`,
        {
          sourcePointer: referencePointer,
          details: errorDetails({ reference: "<non-string>" }),
        },
      );
    }

    if (reference.startsWith(LOCAL_COMPONENT_PREFIX)) {
      schema.$ref = rewriteComponentReference(reference, referencePointer, filenames, currentBase);
    } else {
      let resolved: string;
      try {
        resolved = new URL(reference, currentBase).href;
      } catch {
        throw new JsonSchemaGenerationError(
          "UNSUPPORTED_REFERENCE",
          `Schema reference "${reference}" does not resolve to an embedded resource.`,
          {
            sourcePointer: referencePointer,
            details: errorDetails({ reference }),
          },
        );
      }

      if (!embeddedResources.has(resourceUri(resolved))) {
        throw new JsonSchemaGenerationError(
          "UNSUPPORTED_REFERENCE",
          `Schema reference "${reference}" does not resolve to an embedded resource.`,
          {
            sourcePointer: referencePointer,
            details: errorDetails({ reference, resolvedReference: resolved }),
          },
        );
      }
    }
  }

  for (const [child, childPointer] of schemaChildren(schema, pointer)) {
    rewriteSchemaReferences(child, childPointer, filenames, embeddedResources, scopes);
  }
}

function selectedComponents(
  source: AsyncAPISource,
  extensions: Set<string>,
): readonly BuiltComponent[] {
  if (!isJsonObject(source.data)) {
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "AsyncAPI source root must be an object.",
      { sourcePointer: "" },
    );
  }

  const version = source.data.asyncapi;
  if (typeof version !== "string" || !SUPPORTED_VERSION.test(version)) {
    throw new JsonSchemaGenerationError(
      "UNSUPPORTED_ASYNCAPI_VERSION",
      `AsyncAPI version "${typeof version === "string" ? version : "<missing>"}" is not supported.`,
      {
        sourcePointer: "/asyncapi",
        details: errorDetails({ version: typeof version === "string" ? version : "<missing>" }),
      },
    );
  }

  const components = source.data.components;
  if (components === undefined) {
    return [];
  }
  if (!isJsonObject(components)) {
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "AsyncAPI components must be an object.",
      { sourcePointer: "/components" },
    );
  }

  const schemas = components.schemas;
  if (schemas === undefined) {
    return [];
  }
  if (!isJsonObject(schemas)) {
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "AsyncAPI components.schemas must be an object.",
      { sourcePointer: "/components/schemas" },
    );
  }

  const entries = Object.entries(schemas).sort(([left], [right]) => compareStrings(left, right));
  const componentsByFilename = new Map<string, ComponentSource>();
  const selected: BuiltComponent[] = [];

  for (const [name, authored] of entries) {
    const componentPointer = `/components/schemas/${escapePointerToken(name)}`;
    const filename = componentFilename(name, componentPointer);
    const normalizedFilename = filename.normalize("NFC").toLowerCase();
    const previousSource = componentsByFilename.get(normalizedFilename);
    if (normalizedFilename === "index.schema.json" || previousSource !== undefined) {
      throw new JsonSchemaGenerationError(
        "COMPONENT_NAME_COLLISION",
        `Component artifact filename "${filename}" is reserved or collides with another component.`,
        {
          sourcePointer: componentPointer,
          details: errorDetails({
            componentName: name,
            filename,
            firstSourcePointer: previousSource?.componentPointer ?? "<reserved-index>",
            secondSourcePointer: componentPointer,
          }),
        },
      );
    }

    let schemaValue = authored;
    let schemaPointer = componentPointer;
    if (isJsonObject(authored) && "schemaFormat" in authored && "schema" in authored) {
      const schemaFormat = authored.schemaFormat;
      if (typeof schemaFormat !== "string" || !isDraft07Format(schemaFormat)) {
        throw new JsonSchemaGenerationError(
          "UNSUPPORTED_SCHEMA_FORMAT",
          `Schema format "${typeof schemaFormat === "string" ? schemaFormat : "<non-string>"}" is not supported.`,
          {
            sourcePointer: componentPointer,
            details: errorDetails({
              schemaFormat: typeof schemaFormat === "string" ? schemaFormat : "<non-string>",
            }),
          },
        );
      }
      schemaValue = authored.schema;
      schemaPointer = `${componentPointer}/schema`;
    }

    if (!isMutableSchema(schemaValue)) {
      throw new JsonSchemaGenerationError(
        "INVALID_JSON_SCHEMA",
        `Component schema at "${schemaPointer}" must be an object or boolean.`,
        { sourcePointer: schemaPointer },
      );
    }

    const copiedValue = copyValue(schemaValue, extensions);
    if (!isMutableSchema(copiedValue)) {
      throw new JsonSchemaGenerationError(
        "INVALID_JSON_SCHEMA",
        `Component schema at "${schemaPointer}" must be an object or boolean.`,
        { sourcePointer: schemaPointer },
      );
    }
    const copied = copiedValue as MutableSchema;
    validateDialect(copied, schemaPointer, true);
    if (typeof copied !== "boolean" && copied.$schema === undefined) {
      copied.$schema = DRAFT_07_URI;
    }

    const componentSource = { componentPointer, schemaPointer };
    componentsByFilename.set(normalizedFilename, componentSource);
    selected.push({ name, filename, document: copied, source: componentSource });
  }

  return selected;
}

export function buildOutput(source: AsyncAPISource): BuiltOutput {
  const extensions = new Set<string>();
  const components = selectedComponents(source, extensions);
  const identifiers = new Map<string, string>();
  const scopes = new Map<MutableJsonObject, string | undefined>();

  for (const component of components) {
    indexSchemaResources(
      component.document as MutableSchema,
      component.source.schemaPointer,
      undefined,
      identifiers,
      scopes,
    );
  }

  const embeddedResources = new Set(
    [...identifiers.keys()].map((identifier) => resourceUri(identifier)),
  );
  const filenames = new Map(components.map(({ name, filename }) => [name, filename]));
  for (const component of components) {
    rewriteSchemaReferences(
      component.document as MutableSchema,
      component.source.schemaPointer,
      filenames,
      embeddedResources,
      scopes,
    );
  }

  const definitions = Object.fromEntries(
    components.map(({ name, filename }) => [name, { $ref: `./${encodedFilename(filename)}` }]),
  );
  return {
    index: { $schema: DRAFT_07_URI, definitions },
    components,
    extensionKeywords: extensions,
  };
}
