export type JsonLiteral = string | number | boolean | null;

export type TargetType =
  | { readonly kind: "unknown" }
  | { readonly kind: "never" }
  | { readonly kind: "string" }
  | { readonly kind: "number" }
  | { readonly kind: "boolean" }
  | { readonly kind: "null" }
  | { readonly kind: "literal"; readonly value: JsonLiteral }
  | { readonly kind: "array"; readonly item: TargetType }
  | { readonly kind: "tuple"; readonly items: readonly TargetType[] }
  | {
      readonly kind: "object";
      readonly properties: readonly TargetProperty[];
      readonly index?: TargetType;
    }
  | { readonly kind: "reference"; readonly targetIdentity: string }
  | { readonly kind: "union"; readonly members: readonly TargetType[] }
  | { readonly kind: "intersection"; readonly members: readonly TargetType[] };

export interface TargetProperty {
  readonly name: string;
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly type: TargetType;
  readonly documentation: readonly string[];
}

export interface TargetDeclaration {
  readonly identity: string;
  readonly name: string;
  readonly type: TargetType;
  readonly documentation: readonly string[];
}
