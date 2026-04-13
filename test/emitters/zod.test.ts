import { describe, test } from "vitest";
import { emitZodArtifacts } from "~/emitters/zod";
import { matchArtifacts } from "../support/matchArtifacts";

describe("emitZodArtifacts", () => {
  test("matches snapshots for representative entities", async () => {
    const artifacts = emitZodArtifacts({
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
      outputPath: "zod",
    });

    await matchArtifacts(artifacts, "zod.test.ts");
  });
});
