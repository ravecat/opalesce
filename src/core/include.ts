import type { AsyncApiEntity, IncludeSelector } from "~/types";

const INCLUDE_SELECTORS = new Set<IncludeSelector>([
  "components.schemas",
  "operations.messages.payloads",
  "operations.messages.headers",
  "operations.replies.payloads",
  "operations.replies.headers",
  "channels.parameters",
]);

export function normalizeInclude(include?: IncludeSelector[]): IncludeSelector[] | undefined {
  if (include === undefined) {
    return undefined;
  }

  for (const selector of include) {
    if (!INCLUDE_SELECTORS.has(selector)) {
      throw new Error(`Unknown include selector: ${selector}`);
    }
  }

  return include;
}

export function matchesInclude(entity: AsyncApiEntity, selector: IncludeSelector): boolean {
  switch (selector) {
    case "components.schemas":
      return entity.source === "component" && entity.role === "schema";
    case "operations.messages.payloads":
      return (
        entity.source === "operation" && entity.scope === "message" && entity.role === "payload"
      );
    case "operations.messages.headers":
      return (
        entity.source === "operation" && entity.scope === "message" && entity.role === "header"
      );
    case "operations.replies.payloads":
      return entity.source === "operation" && entity.scope === "reply" && entity.role === "payload";
    case "operations.replies.headers":
      return entity.source === "operation" && entity.scope === "reply" && entity.role === "header";
    case "channels.parameters":
      return entity.source === "channel" && entity.role === "parameter";
  }
}
