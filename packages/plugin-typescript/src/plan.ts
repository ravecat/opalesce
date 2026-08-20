import { posix } from "node:path";
import type { InteractionContract, MessageContract, SchemaRoleContract } from "@opalesce/core";
import { TypeScriptGenerationError } from "./errors.js";
import { assertPortableFilename, pascalCase, portableFilenameKey } from "./naming.js";
import { createSchemaProjector, schemaRoleDocumentation } from "./projection.js";
import type { TargetDeclaration, TargetProperty, TargetType } from "./target.js";

export interface PlannedImport {
  readonly specifier: string;
  readonly names: readonly string[];
}

export interface PlannedExport {
  readonly specifier: string;
  readonly names: readonly string[];
}

export interface PlannedFile {
  readonly path: string;
  readonly imports: readonly PlannedImport[];
  readonly references: readonly PlannedReference[];
  readonly declarations: readonly TargetDeclaration[];
  readonly exports: readonly PlannedExport[];
}

export interface PlannedReference {
  readonly identity: string;
  readonly name: string;
}

interface PublicSymbol {
  readonly identity: string;
  readonly name: string;
  readonly path: string;
  readonly pointer: string;
}

interface FileDraft {
  readonly path: string;
  readonly declarations: TargetDeclaration[];
}

function reference(targetIdentity: string): TargetType {
  return Object.freeze({ kind: "reference", targetIdentity });
}

function union(references: readonly TargetType[]): TargetType {
  if (references.length === 0) {
    return Object.freeze({ kind: "never" });
  }
  if (references.length === 1) {
    return references[0] ?? Object.freeze({ kind: "never" });
  }
  return Object.freeze({ kind: "union", members: Object.freeze([...references]) });
}

function collectReferences(target: TargetType, identities: Set<string>): void {
  switch (target.kind) {
    case "reference":
      identities.add(target.targetIdentity);
      return;
    case "array":
      collectReferences(target.item, identities);
      return;
    case "tuple":
      for (const item of target.items) {
        collectReferences(item, identities);
      }
      return;
    case "object":
      for (const property of target.properties) {
        collectReferences(property.type, identities);
      }
      if (target.index !== undefined) {
        collectReferences(target.index, identities);
      }
      return;
    case "intersection":
    case "union":
      for (const member of target.members) {
        collectReferences(member, identities);
      }
      return;
    case "boolean":
    case "literal":
    case "never":
    case "null":
    case "number":
    case "string":
    case "unknown":
      return;
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

function moduleSpecifier(fromPath: string, toPath: string): string {
  const relative = posix.relative(posix.dirname(fromPath), toPath.replace(/\.ts$/u, ".js"));
  return relative.startsWith(".") ? relative : `./${relative}`;
}

function messageBaseName(
  message: MessageContract,
  channelNameByIdentity: ReadonlyMap<string, string>,
): string {
  const own = pascalCase(message.name, message.pointer);
  if (message.ownerIdentity === undefined) {
    return own;
  }
  const owner = channelNameByIdentity.get(message.ownerIdentity);
  return owner === undefined ? own : `${owner}${own}`;
}

function roleType(
  role: SchemaRoleContract | undefined,
  project: (role: SchemaRoleContract) => TargetType,
): TargetType {
  return role === undefined ? Object.freeze({ kind: "unknown" }) : project(role);
}

export function planFiles(
  interaction: InteractionContract,
  outputPath: string,
): readonly PlannedFile[] {
  const root = outputPath.replace(/\/+$/u, "");
  const projector = createSchemaProjector(interaction);
  const symbols = new Map<string, PublicSymbol>();
  const symbolIdentityByName = new Map<string, string>();
  const filenameKeys = new Map<string, string>();
  const drafts = new Map<string, FileDraft>();
  const channelNameByIdentity = new Map(
    interaction.channels.map((channel) => [
      channel.identity,
      pascalCase(channel.name, channel.pointer),
    ]),
  );

  const addSymbol = (symbol: PublicSymbol): void => {
    const existingIdentity = symbolIdentityByName.get(symbol.name);
    if (existingIdentity !== undefined && existingIdentity !== symbol.identity) {
      const existing = symbols.get(existingIdentity);
      throw new TypeScriptGenerationError(
        "TYPESCRIPT_SYMBOL_COLLISION",
        `The public symbol ${symbol.name} has conflicting interaction identities.`,
        {
          pointer: symbol.pointer,
          details: {
            identity: symbol.identity,
            conflictingIdentity: existingIdentity,
            ...(existing === undefined ? {} : { conflictingPointer: existing.pointer }),
          },
        },
      );
    }
    symbolIdentityByName.set(symbol.name, symbol.identity);
    symbols.set(symbol.identity, Object.freeze(symbol));
  };

  const addFile = (group: string, filename: string, pointer: string): FileDraft => {
    assertPortableFilename(filename, pointer);
    const path = `${root}/${group}/${filename}`;
    const key = `${group}/${portableFilenameKey(filename)}`;
    const existing = filenameKeys.get(key);
    if (existing !== undefined) {
      throw new TypeScriptGenerationError(
        "TYPESCRIPT_FILENAME_COLLISION",
        `The filename ${filename} collides after portable normalization.`,
        { pointer, details: { path, conflictingPath: existing } },
      );
    }
    filenameKeys.set(key, path);
    const current = drafts.get(path);
    if (current !== undefined) {
      return current;
    }
    const draft = { path, declarations: [] };
    drafts.set(path, draft);
    return draft;
  };

  for (const schema of interaction.schemas) {
    const name = pascalCase(schema.name, schema.pointer);
    const file = addFile("schemas", `${name}.ts`, schema.pointer);
    addSymbol({ identity: schema.identity, name, path: file.path, pointer: schema.pointer });
  }

  for (const message of interaction.messages) {
    const base = messageBaseName(message, channelNameByIdentity);
    const file = addFile("messages", `${base}.ts`, message.pointer);
    addSymbol({
      identity: `${message.identity}:payload`,
      name: `${base}Payload`,
      path: file.path,
      pointer: message.payload?.pointer ?? message.pointer,
    });
    if (message.headers !== undefined) {
      addSymbol({
        identity: `${message.identity}:headers`,
        name: `${base}Headers`,
        path: file.path,
        pointer: message.headers.pointer,
      });
    }
    addSymbol({
      identity: `${message.identity}:message`,
      name: `${base}Message`,
      path: file.path,
      pointer: message.pointer,
    });
  }

  for (const channel of interaction.channels) {
    if (channel.parameters.length === 0) {
      continue;
    }
    const base = channelNameByIdentity.get(channel.identity);
    if (base === undefined) {
      throw new TypeScriptGenerationError(
        "TYPESCRIPT_NAME_INVALID",
        `The channel at ${channel.pointer} has no planned name.`,
        { pointer: channel.pointer },
      );
    }
    const name = `${base}Parameters`;
    const file = addFile("channels", `${name}.ts`, channel.pointer);
    addSymbol({
      identity: `${channel.identity}:parameters`,
      name,
      path: file.path,
      pointer: channel.pointer,
    });
  }

  for (const operation of interaction.operations) {
    const base = pascalCase(operation.name, operation.pointer);
    const file = addFile("operations", `${base}.ts`, operation.pointer);
    addSymbol({
      identity: `${operation.identity}:message`,
      name: `${base}Message`,
      path: file.path,
      pointer: operation.pointer,
    });
    if (operation.replyIdentity !== undefined) {
      addSymbol({
        identity: `${operation.identity}:reply-message`,
        name: `${base}ReplyMessage`,
        path: file.path,
        pointer:
          interaction.replies.find((reply) => reply.identity === operation.replyIdentity)
            ?.pointer ?? operation.pointer,
      });
    }
  }

  for (const schema of interaction.schemas) {
    const symbol = symbols.get(schema.identity);
    if (symbol === undefined) {
      continue;
    }
    drafts.get(symbol.path)?.declarations.push(
      Object.freeze({
        identity: symbol.identity,
        name: symbol.name,
        type: projector.project(schema, schema.identity),
        documentation: schemaRoleDocumentation(schema),
      }),
    );
  }

  for (const message of interaction.messages) {
    const payloadSymbol = symbols.get(`${message.identity}:payload`);
    const wrapperSymbol = symbols.get(`${message.identity}:message`);
    if (payloadSymbol === undefined || wrapperSymbol === undefined) {
      continue;
    }
    const file = drafts.get(payloadSymbol.path);
    if (file === undefined) {
      continue;
    }
    file.declarations.push(
      Object.freeze({
        identity: payloadSymbol.identity,
        name: payloadSymbol.name,
        type: roleType(message.payload, (role) => projector.project(role)),
        documentation:
          message.payload === undefined
            ? Object.freeze([])
            : schemaRoleDocumentation(message.payload),
      }),
    );
    const wrapperProperties: TargetProperty[] = [
      Object.freeze({
        name: "payload",
        optional: false,
        readonly: false,
        type: reference(payloadSymbol.identity),
        documentation: Object.freeze([]),
      }),
    ];
    if (message.headers !== undefined) {
      const headerSymbol = symbols.get(`${message.identity}:headers`);
      if (headerSymbol !== undefined) {
        file.declarations.push(
          Object.freeze({
            identity: headerSymbol.identity,
            name: headerSymbol.name,
            type: projector.project(message.headers),
            documentation: schemaRoleDocumentation(message.headers),
          }),
        );
        wrapperProperties.push(
          Object.freeze({
            name: "headers",
            optional: false,
            readonly: false,
            type: reference(headerSymbol.identity),
            documentation: Object.freeze([]),
          }),
        );
      }
    }
    file.declarations.push(
      Object.freeze({
        identity: wrapperSymbol.identity,
        name: wrapperSymbol.name,
        type: Object.freeze({ kind: "object", properties: Object.freeze(wrapperProperties) }),
        documentation: Object.freeze(
          message.description === undefined ? [] : [message.description],
        ),
      }),
    );
  }

  for (const channel of interaction.channels) {
    const symbol = symbols.get(`${channel.identity}:parameters`);
    if (symbol === undefined) {
      continue;
    }
    const properties = channel.parameters.map(
      (parameter): TargetProperty =>
        Object.freeze({
          name: parameter.name,
          optional: false,
          readonly: false,
          type:
            parameter.schema === undefined
              ? Object.freeze({ kind: "string" })
              : projector.project(parameter.schema),
          documentation: Object.freeze([
            ...new Set([
              ...(parameter.description === undefined ? [] : [parameter.description]),
              ...(parameter.schema === undefined ? [] : schemaRoleDocumentation(parameter.schema)),
            ]),
          ]),
        }),
    );
    drafts.get(symbol.path)?.declarations.push(
      Object.freeze({
        identity: symbol.identity,
        name: symbol.name,
        type: Object.freeze({ kind: "object", properties: Object.freeze(properties) }),
        documentation: Object.freeze(
          channel.description === undefined ? [] : [channel.description],
        ),
      }),
    );
  }

  for (const operation of interaction.operations) {
    const messageSymbol = symbols.get(`${operation.identity}:message`);
    if (messageSymbol === undefined) {
      continue;
    }
    const file = drafts.get(messageSymbol.path);
    if (file === undefined) {
      continue;
    }
    file.declarations.push(
      Object.freeze({
        identity: messageSymbol.identity,
        name: messageSymbol.name,
        type: union(
          operation.messageIdentities.map((identity) => reference(`${identity}:message`)),
        ),
        documentation: Object.freeze([
          ...(operation.summary === undefined ? [] : [operation.summary]),
          ...(operation.description === undefined ? [] : [operation.description]),
        ]),
      }),
    );
    if (operation.replyIdentity !== undefined) {
      const replySymbol = symbols.get(`${operation.identity}:reply-message`);
      const reply = interaction.replies.find(
        (candidate) => candidate.identity === operation.replyIdentity,
      );
      if (replySymbol !== undefined && reply !== undefined) {
        file.declarations.push(
          Object.freeze({
            identity: replySymbol.identity,
            name: replySymbol.name,
            type: union(
              reply.messageIdentities.map((identity) => reference(`${identity}:message`)),
            ),
            documentation: Object.freeze([]),
          }),
        );
      }
    }
  }

  const files = [...drafts.values()]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((draft): PlannedFile => {
      const importedNamesByPath = new Map<string, Set<string>>();
      const referenceNames = new Map<string, string>();
      for (const declaration of draft.declarations) {
        const references = new Set<string>();
        collectReferences(declaration.type, references);
        for (const identity of references) {
          const symbol = symbols.get(identity);
          if (symbol === undefined) {
            throw new TypeScriptGenerationError(
              "TYPESCRIPT_SCHEMA_UNSUPPORTED",
              `The dependency ${identity} has no public TypeScript symbol.`,
              { pointer: declaration.name, details: { identity } },
            );
          }
          referenceNames.set(identity, symbol.name);
          if (symbol.path === draft.path) {
            continue;
          }
          const names = importedNamesByPath.get(symbol.path) ?? new Set<string>();
          names.add(symbol.name);
          importedNamesByPath.set(symbol.path, names);
        }
      }
      return Object.freeze({
        path: draft.path,
        imports: Object.freeze(
          [...importedNamesByPath.entries()]
            .map(([path, names]) =>
              Object.freeze({
                specifier: moduleSpecifier(draft.path, path),
                names: Object.freeze([...names].sort((left, right) => left.localeCompare(right))),
              }),
            )
            .sort((left, right) => left.specifier.localeCompare(right.specifier)),
        ),
        references: Object.freeze(
          [...referenceNames.entries()]
            .map(([identity, name]) => Object.freeze({ identity, name }))
            .sort((left, right) => left.identity.localeCompare(right.identity)),
        ),
        declarations: Object.freeze(
          [...draft.declarations].sort((left, right) => left.name.localeCompare(right.name)),
        ),
        exports: Object.freeze([]),
      });
    });

  const exportsByPath = new Map<string, string[]>();
  for (const symbol of symbols.values()) {
    const names = exportsByPath.get(symbol.path) ?? [];
    names.push(symbol.name);
    exportsByPath.set(symbol.path, names);
  }
  const barrelPath = `${root}/index.ts`;
  const barrel: PlannedFile = Object.freeze({
    path: barrelPath,
    imports: Object.freeze([]),
    references: Object.freeze([]),
    declarations: Object.freeze([]),
    exports: Object.freeze(
      [...exportsByPath.entries()]
        .map(([path, names]) =>
          Object.freeze({
            specifier: moduleSpecifier(barrelPath, path),
            names: Object.freeze([...names].sort((left, right) => left.localeCompare(right))),
          }),
        )
        .sort((left, right) => left.specifier.localeCompare(right.specifier)),
    ),
  });

  return Object.freeze([barrel, ...files]);
}
