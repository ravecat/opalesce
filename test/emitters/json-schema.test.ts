import { describe, expect, test } from "vitest";
import { emitJsonSchemaArtifacts } from "~/emitters/json-schema";
import { matchArtifacts } from "../support/matchArtifacts";

describe("emitJsonSchemaArtifacts", () => {
  test(
    "emits deterministic JSON Schema artifacts for representative payload entities",
    async () => {
      const artifacts = emitJsonSchemaArtifacts({
        graph: {
          entities: [
            {
              id: "operations.userCreated.payload",
              source: "operation",
              role: "payload",
              scope: "message",
              name: "UserCreatedPayload",
              schema: {
                type: "object",
                properties: {
                  id: { type: "string" },
                },
                required: ["id"],
              },
              sourcePath:
                "#/operations/userCreated/messages/userCreated/payload",
            },
          ],
          byId: new Map(),
        },
        outputPath: "schemas",
      });

      expect(artifacts[0]?.filePath).toBe(
        "schemas/UserCreatedPayload.schema.json",
      );
      await matchArtifacts(artifacts, ["json-schema"]);
    },
  );
});
