import type { SchemaInterface } from "@asyncapi/parser";
import type { AsyncApiDocument } from "~/core/AsyncApiDocument";
import { normalizeSchema } from "~/core/normalizeSchema";
import type { AsyncApiEntity } from "~/types";

export class SchemaGenerator {
  asyncapi: AsyncApiDocument;

  constructor(asyncapi: AsyncApiDocument) {
    this.asyncapi = asyncapi;
  }

  async build(): Promise<AsyncApiEntity[]> {
    const entities: AsyncApiEntity[] = [];

    for (const schemaModel of this.asyncapi.getComponentSchemas() as SchemaInterface[]) {
      const schemaId = schemaModel.id?.() ?? "Schema";

      entities.push({
        id: `components.schemas.${schemaId}`,
        kind: "component-schema",
        baseName: schemaId,
        name: schemaId,
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
