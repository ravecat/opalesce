import { describe, test } from "vitest";
import { emitZodArtifacts } from "~/emitters/zod";
import { matchArtifacts } from "../support/matchArtifacts";

describe("emitZodArtifacts", () => {
  test("emits deterministic Zod artifacts for representative payload entities", async () => {
    const artifacts = emitZodArtifacts({
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
            sourcePath: "#/operations/userCreated/messages/userCreated/payload",
          },
        ],
        byId: new Map(),
      },
      outputPath: "zod",
    });

    await matchArtifacts(artifacts, ["zod"]);
  });
});
