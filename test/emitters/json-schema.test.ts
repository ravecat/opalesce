import { describe, expect, test } from "vitest";
import { emitJsonSchemaArtifacts } from "~/emitters/json-schema";
import { matchArtifacts } from "../support/matchArtifacts";

describe("emitJsonSchemaArtifacts", () => {
  test("serializes representative entities deterministically", async () => {
    const artifacts = emitJsonSchemaArtifacts({
      graph: {
        entities: [
          {
            id: "operations.userCreated.payload",
            kind: "message-payload",
            name: "UserCreatedPayload",
            schema: {
              type: "object",
              properties: {
                id: { type: "string" },
              },
              required: ["id"],
            },
            sourcePath: "#/operations/userCreated/messages/userCreated/payload",
          },
        ],
        byId: new Map(),
      },
      outputPath: "schemas",
    });

    expect(artifacts[0]?.filePath).toBe(
      "schemas/UserCreatedPayload.schema.json",
    );
    await matchArtifacts(artifacts, "json-schema.test.ts");
  });
});
