import type { SchemaInterface } from "@asyncapi/parser";
import type {
  InteractionAsyncAPIVersion,
  SchemaContract,
  SchemaDependencyContract,
  SchemaRoleContract,
} from "./types.js";

interface ComponentSchemaIdentity {
  readonly identity: string;
  readonly pointer: string;
}

export interface SchemaRegistry {
  readonly roots: readonly SchemaContract[];
  createRole(schema: SchemaInterface): SchemaRoleContract;
}

function parserObject(schema: SchemaInterface): object | undefined {
  const value: unknown = schema.json<unknown>();
  return typeof value === "object" && value !== null ? value : undefined;
}

function effectiveSchemaFormat(schema: SchemaInterface): string {
  const value: unknown = schema.json<unknown>();
  if (
    typeof value === "object" &&
    value !== null &&
    "schemaFormat" in value &&
    typeof value.schemaFormat === "string"
  ) {
    return value.schemaFormat;
  }
  return schema.schemaFormat();
}

function schemaChildren(schema: SchemaInterface): readonly SchemaInterface[] {
  const children: SchemaInterface[] = [];
  const append = (candidate: SchemaInterface | undefined): void => {
    if (candidate !== undefined) {
      children.push(candidate);
    }
  };
  const appendMany = (candidates: readonly SchemaInterface[] | undefined): void => {
    if (candidates !== undefined) {
      children.push(...candidates);
    }
  };

  appendMany(schema.allOf());
  appendMany(schema.anyOf());
  appendMany(schema.oneOf());
  append(schema.not());
  append(schema.if());
  append(schema.then());
  append(schema.else());
  append(schema.contains());
  append(schema.propertyNames());

  const items = schema.items();
  if (Array.isArray(items)) {
    appendMany(items);
  } else {
    append(items);
  }

  const additionalItems = schema.additionalItems();
  if (typeof additionalItems !== "boolean") {
    append(additionalItems);
  }

  const additionalProperties = schema.additionalProperties();
  if (typeof additionalProperties !== "boolean") {
    append(additionalProperties);
  }

  const propertyGroups = [schema.properties(), schema.patternProperties(), schema.definitions()];
  for (const group of propertyGroups) {
    if (group !== undefined) {
      children.push(...Object.values(group));
    }
  }

  const dependencies = schema.dependencies();
  if (dependencies !== undefined) {
    for (const dependency of Object.values(dependencies)) {
      if (!Array.isArray(dependency)) {
        children.push(dependency);
      }
    }
  }

  return children;
}

function sortDependencies(
  dependencies: ReadonlyMap<string, SchemaDependencyContract>,
): readonly SchemaDependencyContract[] {
  return Object.freeze(
    [...dependencies.values()]
      .sort((left, right) => left.targetIdentity.localeCompare(right.targetIdentity))
      .map((dependency) => Object.freeze(dependency)),
  );
}

export function createSchemaRegistry(
  schemas: readonly SchemaInterface[],
  asyncapiVersion: InteractionAsyncAPIVersion,
): SchemaRegistry {
  const identityByObject = new WeakMap<object, ComponentSchemaIdentity>();
  const identityBySchemaId = new Map<string, ComponentSchemaIdentity>();

  for (const schema of schemas) {
    const name = schema.id();
    const identity = `schema:component:${name}`;
    const entry = Object.freeze({ identity, pointer: schema.meta("pointer") });
    const object = parserObject(schema);
    if (object !== undefined) {
      identityByObject.set(object, entry);
    }
    identityBySchemaId.set(name, entry);
  }

  const findComponent = (schema: SchemaInterface): ComponentSchemaIdentity | undefined => {
    const object = parserObject(schema);
    if (object !== undefined) {
      const byObject = identityByObject.get(object);
      if (byObject !== undefined) {
        return byObject;
      }
    }
    return identityBySchemaId.get(schema.id());
  };

  const collectDependencies = (root: SchemaInterface): readonly SchemaDependencyContract[] => {
    const dependencies = new Map<string, SchemaDependencyContract>();
    const visitedObjects = new WeakSet<object>();
    const visitedSchemas = new WeakSet<SchemaInterface>();

    const visit = (schema: SchemaInterface): void => {
      const object = parserObject(schema);
      if (object === undefined) {
        if (visitedSchemas.has(schema)) {
          return;
        }
        visitedSchemas.add(schema);
      } else {
        if (visitedObjects.has(object)) {
          const target = findComponent(schema);
          if (target !== undefined && !dependencies.has(target.identity)) {
            dependencies.set(
              target.identity,
              Object.freeze({
                targetIdentity: target.identity,
                pointer: schema.meta("pointer"),
              }),
            );
          }
          return;
        }
        visitedObjects.add(object);
      }

      for (const child of schemaChildren(schema)) {
        const target = findComponent(child);
        if (target !== undefined && !dependencies.has(target.identity)) {
          dependencies.set(
            target.identity,
            Object.freeze({
              targetIdentity: target.identity,
              pointer: child.meta("pointer"),
            }),
          );
        }
        visit(child);
      }
    };

    visit(root);
    return sortDependencies(dependencies);
  };

  const createRole = (schema: SchemaInterface): SchemaRoleContract =>
    Object.freeze({
      pointer: schema.meta("pointer"),
      schemaFormat: effectiveSchemaFormat(schema),
      schema,
      dependencies: collectDependencies(schema),
    });

  const roots = Object.freeze(
    [...schemas]
      .map((schema): SchemaContract => {
        const name = schema.id();
        const role = createRole(schema);
        return Object.freeze({
          identity: `schema:component:${name}`,
          kind: "schema",
          name,
          pointer: role.pointer,
          asyncapiVersion,
          schemaFormat: role.schemaFormat,
          schema: role.schema,
          dependencies: role.dependencies,
        });
      })
      .sort((left, right) => left.identity.localeCompare(right.identity)),
  );

  return Object.freeze({ roots, createRole });
}
