import type { SchemaInterface } from "@asyncapi/parser";
import type { AsyncApiDocument } from "~/core/AsyncApiDocument";
import { normalizeSchema } from "~/core/normalizeSchema";
import type { AsyncApiEntitySeed } from "~/types";

export class SchemaGenerator {
  asyncapi: AsyncApiDocument;

  constructor(asyncapi: AsyncApiDocument) {
    this.asyncapi = asyncapi;
  }

  async build(): Promise<AsyncApiEntitySeed[]> {
    const entities: AsyncApiEntitySeed[] = [];

    for (const schemaModel of this.asyncapi.getComponentSchemas() as SchemaInterface[]) {
      const schemaId = schemaModel.id?.() ?? "Schema";

      entities.push({
        id: `components.schemas.${schemaId}`,
        source: "component",
        role: "schema",
        canonicalKey: `component:${schemaId}`,
        displayNameHint: schemaId,
        identity: {
          schemaId,
          schemaTitle: schemaModel.title?.(),
        },
        schema: await normalizeSchema({
          schemaModel,
          schemaFormat: schemaModel.schemaFormat?.(),
          name: schemaId,
        }),
        sourcePath: `#/components/schemas/${schemaId}`,
      });
    }

    return entities;
  }
}
