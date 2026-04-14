import { describe, expect, test } from "vitest";
import { canonicalizeEntities } from "~/core/canonicalizeEntities";
import { assignEntityNames } from "~/core/naming";

describe("canonicalizeEntities", () => {
  test("prefers component entities over operation payload duplicates", () => {
    const entities = canonicalizeEntities([
      {
        id: "components.schemas.game",
        source: "component",
        role: "schema",
        canonicalKey: "component:game",
        displayNameHint: "game",
        identity: {
          schemaId: "game",
        },
        schema: { type: "object" },
        sourcePath: "#/components/schemas/game",
      },
      {
        id: "operations.state.messages.state.payload",
        source: "operation",
        role: "payload",
        scope: "message",
        canonicalKey: "component:game",
        displayNameHint: "statePayload",
        namespaceHint: "state",
        identity: {
          schemaId: "game",
          operationId: "state",
          messageId: "state",
        },
        schema: { type: "object" },
        sourcePath: "#/operations/state/messages/state/payload",
      },
    ]);

    expect(entities).toHaveLength(1);
    expect(assignEntityNames(entities)[0]?.name).toBe("Game");
  });
});
