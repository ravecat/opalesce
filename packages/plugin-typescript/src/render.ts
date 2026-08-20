import ts from "typescript";
import { TypeScriptGenerationError } from "./errors.js";
import { isTypeScriptIdentifier } from "./naming.js";
import type { PlannedFile } from "./plan.js";
import type { TargetProperty, TargetType } from "./target.js";

function documentationText(lines: readonly string[]): string {
  const escaped = lines
    .flatMap((line) => line.replace(/\*\//gu, "*\\/").split(/\r?\n/u))
    .map((line) => ` * ${line}`)
    .join("\n");
  return `*\n${escaped}\n `;
}

function withDocumentation<Node extends ts.Node>(node: Node, lines: readonly string[]): Node {
  return lines.length === 0
    ? node
    : ts.addSyntheticLeadingComment(
        node,
        ts.SyntaxKind.MultiLineCommentTrivia,
        documentationText(lines),
        true,
      );
}

function propertyName(name: string): ts.PropertyName {
  return isTypeScriptIdentifier(name)
    ? ts.factory.createIdentifier(name)
    : ts.factory.createStringLiteral(name);
}

function literalType(value: string | number | boolean | null): ts.TypeNode {
  if (value === null) {
    return ts.factory.createLiteralTypeNode(ts.factory.createNull());
  }
  if (typeof value === "string") {
    return ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(value));
  }
  if (typeof value === "number") {
    const literal =
      value < 0
        ? ts.factory.createPrefixUnaryExpression(
            ts.SyntaxKind.MinusToken,
            ts.factory.createNumericLiteral(Math.abs(value)),
          )
        : ts.factory.createNumericLiteral(value);
    return ts.factory.createLiteralTypeNode(literal);
  }
  return ts.factory.createLiteralTypeNode(
    value ? ts.factory.createTrue() : ts.factory.createFalse(),
  );
}

function propertySignature(
  property: TargetProperty,
  referenceNames: ReadonlyMap<string, string>,
): ts.PropertySignature {
  return withDocumentation(
    ts.factory.createPropertySignature(
      property.readonly ? [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)] : undefined,
      propertyName(property.name),
      property.optional ? ts.factory.createToken(ts.SyntaxKind.QuestionToken) : undefined,
      typeNode(property.type, referenceNames),
    ),
    property.documentation,
  );
}

function typeNode(target: TargetType, referenceNames: ReadonlyMap<string, string>): ts.TypeNode {
  switch (target.kind) {
    case "unknown":
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
    case "never":
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
    case "string":
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
    case "number":
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
    case "boolean":
      return ts.factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
    case "null":
      return ts.factory.createLiteralTypeNode(ts.factory.createNull());
    case "literal":
      return literalType(target.value);
    case "array":
      return ts.factory.createArrayTypeNode(typeNode(target.item, referenceNames));
    case "tuple":
      return ts.factory.createTupleTypeNode(
        target.items.map((item) => typeNode(item, referenceNames)),
      );
    case "object": {
      const members: ts.TypeElement[] = target.properties.map((property) =>
        propertySignature(property, referenceNames),
      );
      if (target.index !== undefined) {
        members.push(
          ts.factory.createIndexSignature(
            undefined,
            [
              ts.factory.createParameterDeclaration(
                undefined,
                undefined,
                "key",
                undefined,
                ts.factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
              ),
            ],
            typeNode(target.index, referenceNames),
          ),
        );
      }
      return ts.factory.createTypeLiteralNode(members);
    }
    case "reference": {
      const name = referenceNames.get(target.targetIdentity);
      if (name === undefined) {
        throw new TypeScriptGenerationError(
          "TYPESCRIPT_SCHEMA_UNSUPPORTED",
          `The TypeScript reference ${target.targetIdentity} has no planned symbol.`,
          { pointer: target.targetIdentity, details: { identity: target.targetIdentity } },
        );
      }
      return ts.factory.createTypeReferenceNode(name);
    }
    case "union":
      return ts.factory.createUnionTypeNode(
        target.members.map((member) => typeNode(member, referenceNames)),
      );
    case "intersection":
      return ts.factory.createIntersectionTypeNode(
        target.members.map((member) => typeNode(member, referenceNames)),
      );
    default: {
      const exhaustive: never = target;
      return exhaustive;
    }
  }
}

function normalizeIndentation(source: string): string {
  return source.replace(/^( +)/gmu, (indent) => {
    const levels = Math.floor(indent.length / 4);
    const remainder = indent.length % 4;
    return " ".repeat(levels * 2 + remainder);
  });
}

function validateSyntax(path: string, contents: string): void {
  const result = ts.transpileModule(contents, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  const diagnostic = result.diagnostics?.find(
    (candidate) => candidate.category === ts.DiagnosticCategory.Error,
  );
  if (diagnostic !== undefined) {
    throw new TypeScriptGenerationError(
      "TYPESCRIPT_SYNTAX_INVALID",
      `Generated TypeScript at ${path} is invalid: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`,
      { pointer: path, details: { path } },
    );
  }
}

export function renderFile(file: PlannedFile): string {
  const referenceNames = new Map(
    file.references.map((reference) => [reference.identity, reference.name]),
  );
  const statements: ts.Statement[] = [];

  for (const entry of file.imports) {
    statements.push(
      ts.factory.createImportDeclaration(
        undefined,
        ts.factory.createImportClause(
          true,
          undefined,
          ts.factory.createNamedImports(
            entry.names.map((name) =>
              ts.factory.createImportSpecifier(false, undefined, ts.factory.createIdentifier(name)),
            ),
          ),
        ),
        ts.factory.createStringLiteral(entry.specifier),
      ),
    );
  }

  for (const declaration of file.declarations) {
    statements.push(
      withDocumentation(
        ts.factory.createTypeAliasDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          declaration.name,
          undefined,
          typeNode(declaration.type, referenceNames),
        ),
        declaration.documentation,
      ),
    );
  }

  for (const entry of file.exports) {
    statements.push(
      ts.factory.createExportDeclaration(
        undefined,
        true,
        ts.factory.createNamedExports(
          entry.names.map((name) =>
            ts.factory.createExportSpecifier(false, undefined, ts.factory.createIdentifier(name)),
          ),
        ),
        ts.factory.createStringLiteral(entry.specifier),
      ),
    );
  }

  const sourceFile = ts.factory.updateSourceFile(
    ts.createSourceFile(file.path, "", ts.ScriptTarget.ESNext, false, ts.ScriptKind.TS),
    statements,
  );
  const printed = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(sourceFile);
  const contents = `${normalizeIndentation(printed).trimEnd()}\n`;
  validateSyntax(file.path, contents);
  return contents;
}
