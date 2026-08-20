import type { InteractionContract, SchemaContract, SchemaRoleContract } from "@opalesce/core";
import { TypeScriptGenerationError } from "./errors.js";
import type { JsonLiteral, TargetProperty, TargetType } from "./target.js";

const UNKNOWN: TargetType = Object.freeze({ kind: "unknown" });
const NEVER: TargetType = Object.freeze({ kind: "never" });
const NULL: TargetType = Object.freeze({ kind: "null" });
type SchemaInterface = SchemaContract["schema"];

function parserObject(schema: SchemaInterface): object | undefined {
  const value: unknown = schema.json<unknown>();
  return typeof value === "object" && value !== null ? value : undefined;
}

function nullableFromSchema(schema: SchemaInterface): boolean {
  const value: unknown = schema.json<unknown>();
  return (
    typeof value === "object" && value !== null && "nullable" in value && value.nullable === true
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function wrappedSchema(schema: SchemaInterface): unknown {
  const value: unknown = schema.json<unknown>();
  return isRecord(value) && "schemaFormat" in value && "schema" in value ? value.schema : undefined;
}

function rawDocumentation(value: unknown): readonly string[] {
  if (!isRecord(value)) {
    return Object.freeze([]);
  }
  const documentation: string[] = [];
  if (typeof value.description === "string") {
    documentation.push(value.description);
  }
  if (value.deprecated === true) {
    documentation.push("@deprecated");
  }
  if (typeof value.format === "string") {
    documentation.push(`@format ${value.format}`);
  }
  if (value.readOnly === true) {
    documentation.push("@readOnly");
  }
  if (value.writeOnly === true) {
    documentation.push("@writeOnly");
  }
  return Object.freeze(documentation);
}

function literal(value: unknown, pointer: string): JsonLiteral {
  if (
    value === null ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  ) {
    return value;
  }
  throw new TypeScriptGenerationError(
    "TYPESCRIPT_SCHEMA_UNSUPPORTED",
    `The literal at ${pointer} is not a JSON primitive.`,
    { pointer },
  );
}

function primitive(type: string): TargetType {
  switch (type) {
    case "string":
      return Object.freeze({ kind: "string" });
    case "integer":
    case "number":
      return Object.freeze({ kind: "number" });
    case "boolean":
      return Object.freeze({ kind: "boolean" });
    case "null":
      return NULL;
    default:
      return UNKNOWN;
  }
}

function targetKey(target: TargetType): string {
  switch (target.kind) {
    case "unknown":
    case "never":
    case "string":
    case "number":
    case "boolean":
    case "null":
      return target.kind;
    case "literal":
      return `literal:${JSON.stringify(target.value)}`;
    case "reference":
      return `reference:${target.targetIdentity}`;
    case "array":
      return `array:${targetKey(target.item)}`;
    case "tuple":
      return `tuple:${target.items.map(targetKey).join(",")}`;
    case "object":
      return `object:${target.properties.map((property) => property.name).join(",")}`;
    case "intersection":
    case "union":
      return `${target.kind}:${target.members.map(targetKey).join(",")}`;
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

function combine(kind: "intersection" | "union", members: readonly TargetType[]): TargetType {
  const unique = new Map<string, TargetType>();
  for (const member of members) {
    if (member.kind === kind) {
      for (const nested of member.members) {
        unique.set(targetKey(nested), nested);
      }
    } else {
      unique.set(targetKey(member), member);
    }
  }
  const values = [...unique.values()];
  if (values.length === 0) {
    return kind === "intersection" ? UNKNOWN : NEVER;
  }
  if (values.length === 1) {
    return values[0] ?? UNKNOWN;
  }
  return Object.freeze({ kind, members: Object.freeze(values) });
}

function isAssignableTo(source: TargetType, target: TargetType): boolean {
  if (target.kind === "unknown" || source.kind === "never") {
    return true;
  }
  if (source.kind === target.kind && targetKey(source) === targetKey(target)) {
    return true;
  }
  if (source.kind === "literal") {
    return (
      (typeof source.value === "string" && target.kind === "string") ||
      (typeof source.value === "number" && target.kind === "number") ||
      (typeof source.value === "boolean" && target.kind === "boolean") ||
      (source.value === null && target.kind === "null")
    );
  }
  if (source.kind === "union") {
    return source.members.every((member) => isAssignableTo(member, target));
  }
  return false;
}

export function schemaDocumentation(schema: SchemaInterface): readonly string[] {
  const documentation: string[] = [];
  const description = schema.description();
  if (description !== undefined) {
    documentation.push(description);
  }
  if (schema.deprecated()) {
    documentation.push("@deprecated");
  }
  const format = schema.format();
  if (format !== undefined) {
    documentation.push(`@format ${format}`);
  }
  if (schema.readOnly() === true) {
    documentation.push("@readOnly");
  }
  if (schema.writeOnly() === true) {
    documentation.push("@writeOnly");
  }
  const discriminator = schema.discriminator();
  if (discriminator !== undefined) {
    documentation.push(`@discriminator ${discriminator}`);
  }
  const defaultValue: unknown = schema.default();
  const encodedDefault = encodeAnnotation(defaultValue);
  if (encodedDefault !== undefined) {
    documentation.push(`@default ${encodedDefault}`);
  }
  const examples: readonly unknown[] | undefined = schema.examples();
  if (examples !== undefined) {
    for (const example of examples) {
      const encoded = encodeAnnotation(example);
      if (encoded !== undefined) {
        documentation.push(`@example ${encoded}`);
      }
    }
  }
  const constraints = [
    ["minimum", schema.minimum()],
    ["maximum", schema.maximum()],
    ["minLength", schema.minLength()],
    ["maxLength", schema.maxLength()],
    ["minItems", schema.minItems()],
    ["maxItems", schema.maxItems()],
    ["minProperties", schema.minProperties()],
    ["maxProperties", schema.maxProperties()],
    ["multipleOf", schema.multipleOf()],
  ] satisfies readonly (readonly [string, number | undefined])[];
  for (const [name, value] of constraints) {
    if (value !== undefined) {
      documentation.push(`@${name} ${value}`);
    }
  }
  const pattern = schema.pattern();
  if (pattern !== undefined) {
    documentation.push(`@pattern ${pattern}`);
  }
  return Object.freeze(documentation);
}

export function schemaRoleDocumentation(role: SchemaRoleContract): readonly string[] {
  const rawSchema = wrappedSchema(role.schema);
  return role.schemaFormat === "application/schema+json;version=draft-07" && rawSchema !== undefined
    ? rawDocumentation(rawSchema)
    : schemaDocumentation(role.schema);
}

function encodeAnnotation(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

export interface SchemaProjector {
  project(role: SchemaRoleContract, declarationRootIdentity?: string): TargetType;
}

export function createSchemaProjector(interaction: InteractionContract): SchemaProjector {
  const identityByObject = new WeakMap<object, string>();
  const identityById = new Map<string, string>();

  for (const schema of interaction.schemas) {
    const object = parserObject(schema.schema);
    if (object !== undefined) {
      identityByObject.set(object, schema.identity);
    }
    identityById.set(schema.schema.id(), schema.identity);
  }

  const referencedIdentity = (schema: SchemaInterface): string | undefined => {
    const object = parserObject(schema);
    if (object !== undefined) {
      const identity = identityByObject.get(object);
      if (identity !== undefined) {
        return identity;
      }
    }
    return identityById.get(schema.id());
  };

  const assertFormat = (format: string, pointer: string): void => {
    if (
      !format.startsWith("application/vnd.aai.asyncapi;version=") &&
      format !== "application/schema+json;version=draft-07"
    ) {
      throw new TypeScriptGenerationError(
        "TYPESCRIPT_FORMAT_UNSUPPORTED",
        `Schema format ${format} is not supported by the TypeScript plugin.`,
        { pointer, details: { format } },
      );
    }
  };

  function projectRawObject(
    value: Readonly<Record<string, unknown>>,
    pointer: string,
    declarationRootIdentity: string | undefined,
  ): TargetType {
    const requiredValues = Array.isArray(value.required) ? value.required : [];
    const required = new Set(
      requiredValues.filter((entry): entry is string => typeof entry === "string"),
    );
    const propertyValues = isRecord(value.properties) ? value.properties : {};
    const properties: TargetProperty[] = Object.entries(propertyValues)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, property]) =>
        Object.freeze({
          name,
          optional: !required.has(name),
          readonly: isRecord(property) && property.readOnly === true,
          type: projectRawSchema(
            property,
            `${pointer}/properties/${name.replace(/~/gu, "~0").replace(/\//gu, "~1")}`,
            declarationRootIdentity,
          ),
          documentation: rawDocumentation(property),
        }),
      );

    let index: TargetType | undefined;
    if (value.additionalProperties === true || value.additionalProperties === undefined) {
      index = UNKNOWN;
    } else if (
      isRecord(value.additionalProperties) ||
      typeof value.additionalProperties === "boolean"
    ) {
      if (value.additionalProperties !== false) {
        const candidate = projectRawSchema(
          value.additionalProperties,
          `${pointer}/additionalProperties`,
          declarationRootIdentity,
        );
        index = properties.every((property) => isAssignableTo(property.type, candidate))
          ? candidate
          : UNKNOWN;
      }
    }

    return Object.freeze({
      kind: "object",
      properties: Object.freeze(properties),
      ...(index === undefined ? {} : { index }),
    });
  }

  function projectRawSchema(
    value: unknown,
    pointer: string,
    declarationRootIdentity: string | undefined,
  ): TargetType {
    if (value === true) {
      return UNKNOWN;
    }
    if (value === false) {
      return NEVER;
    }
    if (!isRecord(value)) {
      throw new TypeScriptGenerationError(
        "TYPESCRIPT_SCHEMA_UNSUPPORTED",
        `Draft 07 schema at ${pointer} is not an object or boolean.`,
        { pointer },
      );
    }

    if (typeof value.$ref === "string") {
      const prefix = "#/components/schemas/";
      if (value.$ref.startsWith(prefix)) {
        const name = value.$ref.slice(prefix.length).replace(/~1/gu, "/").replace(/~0/gu, "~");
        const targetIdentity = identityById.get(name);
        if (targetIdentity !== undefined) {
          return Object.freeze({ kind: "reference", targetIdentity });
        }
      }
      throw new TypeScriptGenerationError(
        "TYPESCRIPT_SCHEMA_UNSUPPORTED",
        `Draft 07 reference ${value.$ref} at ${pointer} has no public schema target.`,
        { pointer, details: { reference: value.$ref } },
      );
    }

    if ("const" in value) {
      return Object.freeze({ kind: "literal", value: literal(value.const, pointer) });
    }
    if (Array.isArray(value.enum)) {
      return combine(
        "union",
        value.enum.map((entry) =>
          Object.freeze({ kind: "literal", value: literal(entry, pointer) }),
        ),
      );
    }

    const allOf = Array.isArray(value.allOf) ? value.allOf : [];
    if (allOf.length > 0) {
      const own = isRecord(value.properties)
        ? [projectRawObject(value, pointer, declarationRootIdentity)]
        : [];
      return combine("intersection", [
        ...allOf.map((entry, index) =>
          projectRawSchema(entry, `${pointer}/allOf/${index}`, declarationRootIdentity),
        ),
        ...own,
      ]);
    }

    const alternatives = [
      ...(Array.isArray(value.anyOf) ? value.anyOf : []),
      ...(Array.isArray(value.oneOf) ? value.oneOf : []),
    ];
    if (alternatives.length > 0) {
      const alternative = combine(
        "union",
        alternatives.map((entry, index) =>
          projectRawSchema(entry, `${pointer}/alternatives/${index}`, declarationRootIdentity),
        ),
      );
      return isRecord(value.properties)
        ? combine("intersection", [
            projectRawObject(value, pointer, declarationRootIdentity),
            alternative,
          ])
        : alternative;
    }

    let result: TargetType;
    if (Array.isArray(value.type)) {
      result = combine(
        "union",
        value.type.filter((entry): entry is string => typeof entry === "string").map(primitive),
      );
    } else {
      switch (value.type) {
        case "array": {
          if (Array.isArray(value.items)) {
            result = Object.freeze({
              kind: "tuple",
              items: Object.freeze(
                value.items.map((entry, index) =>
                  projectRawSchema(entry, `${pointer}/items/${index}`, declarationRootIdentity),
                ),
              ),
            });
          } else {
            result = Object.freeze({
              kind: "array",
              item:
                value.items === undefined
                  ? UNKNOWN
                  : projectRawSchema(value.items, `${pointer}/items`, declarationRootIdentity),
            });
          }
          break;
        }
        case "object":
          result = projectRawObject(value, pointer, declarationRootIdentity);
          break;
        case "boolean":
        case "integer":
        case "null":
        case "number":
        case "string":
          result = primitive(value.type);
          break;
        default:
          result = isRecord(value.properties)
            ? projectRawObject(value, pointer, declarationRootIdentity)
            : UNKNOWN;
      }
    }
    return value.nullable === true && result.kind !== "null"
      ? combine("union", [result, NULL])
      : result;
  }

  const projectNative = (
    schema: SchemaInterface,
    declarationRootIdentity: string | undefined,
    root: boolean,
    visiting: WeakSet<object>,
  ): TargetType => {
    const reference = referencedIdentity(schema);
    if (reference !== undefined && (!root || reference !== declarationRootIdentity)) {
      return Object.freeze({ kind: "reference", targetIdentity: reference });
    }

    const object = parserObject(schema);
    if (object !== undefined) {
      if (visiting.has(object)) {
        if (reference !== undefined) {
          return Object.freeze({ kind: "reference", targetIdentity: reference });
        }
        throw new TypeScriptGenerationError(
          "TYPESCRIPT_SCHEMA_UNSUPPORTED",
          `Anonymous recursive schema at ${schema.meta("pointer")} has no stable reference target.`,
          { pointer: schema.meta("pointer") },
        );
      }
      visiting.add(object);
    }

    const projectChild = (child: SchemaInterface): TargetType =>
      projectNative(child, declarationRootIdentity, false, visiting);

    let result: TargetType;
    if (schema.isBooleanSchema()) {
      const value: unknown = schema.json<unknown>();
      result = value === false ? NEVER : UNKNOWN;
    } else {
      const constant: unknown = schema.const();
      const enumeration: readonly unknown[] | undefined = schema.enum();
      if (constant !== undefined) {
        result = Object.freeze({
          kind: "literal",
          value: literal(constant, schema.meta("pointer")),
        });
      } else if (enumeration !== undefined) {
        result = combine(
          "union",
          enumeration.map((value) =>
            Object.freeze({
              kind: "literal",
              value: literal(value, schema.meta("pointer")),
            }),
          ),
        );
      } else {
        const intersections = schema.allOf()?.map(projectChild) ?? [];
        const alternatives = [...(schema.anyOf() ?? []), ...(schema.oneOf() ?? [])];
        if (intersections.length > 0) {
          const properties = schema.properties();
          const own = properties === undefined ? [] : [projectObject(schema, projectChild)];
          result = combine("intersection", [...intersections, ...own]);
        } else if (alternatives.length > 0) {
          const alternative = combine("union", alternatives.map(projectChild));
          result =
            schema.properties() === undefined
              ? alternative
              : combine("intersection", [projectObject(schema, projectChild), alternative]);
        } else {
          const schemaType = schema.type();
          if (Array.isArray(schemaType)) {
            result = combine("union", schemaType.map(primitive));
          } else {
            switch (schemaType) {
              case "array": {
                const items = schema.items();
                result = Array.isArray(items)
                  ? Object.freeze({ kind: "tuple", items: Object.freeze(items.map(projectChild)) })
                  : Object.freeze({
                      kind: "array",
                      item: items === undefined ? UNKNOWN : projectChild(items),
                    });
                break;
              }
              case "object":
                result = projectObject(schema, projectChild);
                break;
              case "boolean":
              case "integer":
              case "null":
              case "number":
              case "string":
                result = primitive(schemaType);
                break;
              default:
                result =
                  schema.properties() === undefined ? UNKNOWN : projectObject(schema, projectChild);
            }
          }
        }
      }
    }

    if (object !== undefined) {
      visiting.delete(object);
    }
    return nullableFromSchema(schema) && result.kind !== "null"
      ? combine("union", [result, NULL])
      : result;
  };

  const projectObject = (
    schema: SchemaInterface,
    projectChild: (child: SchemaInterface) => TargetType,
  ): TargetType => {
    const required = new Set(schema.required() ?? []);
    const properties: TargetProperty[] = Object.entries(schema.properties() ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, property]) =>
        Object.freeze({
          name,
          optional: !required.has(name),
          readonly: property.readOnly() === true,
          type: projectChild(property),
          documentation: schemaDocumentation(property),
        }),
      );

    const additional = schema.additionalProperties();
    let index: TargetType | undefined;
    if (additional === true) {
      index = UNKNOWN;
    } else if (typeof additional === "object") {
      const candidate = projectChild(additional);
      index = properties.every((property) => isAssignableTo(property.type, candidate))
        ? candidate
        : UNKNOWN;
    }

    return Object.freeze({
      kind: "object",
      properties: Object.freeze(properties),
      ...(index === undefined ? {} : { index }),
    });
  };

  return Object.freeze({
    project(role: SchemaRoleContract, declarationRootIdentity?: string): TargetType {
      assertFormat(role.schemaFormat, role.pointer);
      const rawSchema = wrappedSchema(role.schema);
      if (
        role.schemaFormat === "application/schema+json;version=draft-07" &&
        rawSchema !== undefined
      ) {
        return projectRawSchema(rawSchema, role.pointer, declarationRootIdentity);
      }
      return projectNative(role.schema, declarationRootIdentity, true, new WeakSet());
    },
  });
}

export function schemaRootByIdentity(
  interaction: InteractionContract,
  identity: string,
): SchemaContract | undefined {
  return interaction.schemas.find((schema) => schema.identity === identity);
}
