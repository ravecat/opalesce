import { describe, expect, test } from "vitest";
import { emitTypescriptArtifacts } from "~/emitters/typescript";
import { matchArtifacts } from "../support/matchArtifacts";

describe("emitTypescriptArtifacts", () => {
  test("matches snapshots for representative entities", async () => {
    const artifacts = await emitTypescriptArtifacts({
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
      outputPath: "types",
    });

    expect(artifacts).toHaveLength(1);
    await matchArtifacts(artifacts, "typescript.test.ts");
  });
});
