import type { AsyncAPISource, JsonObject, JsonValue } from "@opalesce/core";
import { JsonSchemaGenerationError } from "./errors.js";

export const DRAFT_07_URI = "http://json-schema.org/draft-07/schema#";

const LOCAL_COMPONENT_PREFIX = "#/components/schemas/";
const SUPPORTED_VERSION = /^(?:2\.6|3\.0|3\.1)\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
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

interface DefinitionSource {
  readonly componentPointer: string;
  readonly schemaPointer: string;
}

export interface BuiltBundle {
  readonly document: JsonObject;
  readonly definitionSources: ReadonlyMap<string, DefinitionSource>;
  readonly extensionKeywords: ReadonlySet<string>;
  readonly validationUri: string;
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
  return /^(?:http|https):\/\/json-schema\.org\/draft-07\/schema#?$/.test(value);
}

function isDraft07Format(value: string): boolean {
  return value.toLowerCase().replaceAll(/\s+/g, "") === "application/schema+json;version=draft-07";
}

function validateDialect(
  schema: MutableSchema,
  componentPointer: string,
  schemaPointer: string,
): void {
  if (typeof schema === "boolean") {
    return;
  }

  const dialect = schema.$schema;
  if (dialect !== undefined && (typeof dialect !== "string" || !isDraft07Dialect(dialect))) {
    throw new JsonSchemaGenerationError(
      "DIALECT_CONFLICT",
      `Schema at "${componentPointer}" does not declare JSON Schema Draft 07.`,
      {
        sourcePointer: componentPointer,
        details: errorDetails({
          dialect: typeof dialect === "string" ? dialect : "<non-string>",
          dialectPointer: `${schemaPointer}/$schema`,
        }),
      },
    );
  }

  for (const [child, childPointer] of schemaChildren(schema, schemaPointer)) {
    validateDialect(child, componentPointer, childPointer);
  }
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

function rewriteComponentReference(
  reference: string,
  pointer: string,
  componentNames: ReadonlySet<string>,
  currentBase: string | undefined,
): string {
  const remainder = reference.slice(LOCAL_COMPONENT_PREFIX.length);
  const encodedComponent = remainder.split("/", 1)[0];
  const component =
    encodedComponent === undefined ? undefined : decodePointerToken(encodedComponent);

  if (component === undefined || !componentNames.has(component)) {
    throw new JsonSchemaGenerationError(
      "UNRESOLVED_REFERENCE",
      `Component schema reference "${reference}" does not resolve.`,
      {
        sourcePointer: pointer,
        details: errorDetails({ reference }),
      },
    );
  }

  const bundlePointer = `#/definitions/${remainder}`;
  if (currentBase === undefined) {
    return bundlePointer;
  }

  throw new JsonSchemaGenerationError(
    "UNSUPPORTED_REFERENCE",
    `Component schema reference "${reference}" cannot be rewritten safely under an authored $id.`,
    {
      sourcePointer: pointer,
      details: errorDetails({ reference, reason: "identifier-scoped-component-reference" }),
    },
  );
}

function rewriteSchemaReferences(
  schema: MutableSchema,
  pointer: string,
  componentNames: ReadonlySet<string>,
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
      schema.$ref = rewriteComponentReference(
        reference,
        referencePointer,
        componentNames,
        currentBase,
      );
    } else if (reference.startsWith("#")) {
      throw new JsonSchemaGenerationError(
        "UNSUPPORTED_REFERENCE",
        `Schema reference "${reference}" points outside the exported component root set.`,
        {
          sourcePointer: referencePointer,
          details: errorDetails({ reference }),
        },
      );
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
    rewriteSchemaReferences(child, childPointer, componentNames, embeddedResources, scopes);
  }
}

function selectedSchemas(
  source: AsyncAPISource,
  extensions: Set<string>,
): {
  readonly definitions: Record<string, MutableSchema>;
  readonly sources: Map<string, DefinitionSource>;
} {
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
    return { definitions: {}, sources: new Map() };
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
    return { definitions: {}, sources: new Map() };
  }
  if (!isJsonObject(schemas)) {
    throw new JsonSchemaGenerationError(
      "INVALID_JSON_SCHEMA",
      "AsyncAPI components.schemas must be an object.",
      { sourcePointer: "/components/schemas" },
    );
  }

  const definitionEntries: Array<readonly [string, MutableSchema]> = [];
  const sources = new Map<string, DefinitionSource>();
  for (const [componentName, authored] of Object.entries(schemas)) {
    const componentPointer = `/components/schemas/${escapePointerToken(componentName)}`;
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

    const copied = copyValue(schemaValue, extensions);
    if (!isMutableSchema(copied)) {
      throw new JsonSchemaGenerationError(
        "INVALID_JSON_SCHEMA",
        `Component schema at "${schemaPointer}" must be an object or boolean.`,
        { sourcePointer: schemaPointer },
      );
    }
    validateDialect(copied, componentPointer, schemaPointer);
    definitionEntries.push([componentName, copied]);
    sources.set(componentName, { componentPointer, schemaPointer });
  }

  return { definitions: Object.fromEntries(definitionEntries), sources };
}

export function buildBundle(source: AsyncAPISource): BuiltBundle {
  const extensions = new Set<string>();
  const { definitions, sources } = selectedSchemas(source, extensions);
  const identifiers = new Map<string, string>();
  const scopes = new Map<MutableJsonObject, string | undefined>();

  for (const [name, schema] of Object.entries(definitions)) {
    const definitionSource = sources.get(name);
    if (definitionSource === undefined) {
      throw new Error(`Missing source metadata for component schema "${name}".`);
    }
    indexSchemaResources(schema, definitionSource.schemaPointer, undefined, identifiers, scopes);
  }

  const embeddedResources = new Set(
    [...identifiers.keys()].map((identifier) => resourceUri(identifier)),
  );
  const componentNames = new Set(Object.keys(definitions));
  for (const [name, schema] of Object.entries(definitions)) {
    const definitionSource = sources.get(name);
    if (definitionSource === undefined) {
      throw new Error(`Missing source metadata for component schema "${name}".`);
    }
    rewriteSchemaReferences(
      schema,
      definitionSource.schemaPointer,
      componentNames,
      embeddedResources,
      scopes,
    );
  }

  const document: MutableJsonObject = {
    $schema: DRAFT_07_URI,
    definitions,
  };

  return {
    document,
    definitionSources: sources,
    extensionKeywords: extensions,
    validationUri: "urn:opalesce:json-schema-bundle",
  };
}
