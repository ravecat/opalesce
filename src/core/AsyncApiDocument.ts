import type {
  AsyncAPIDocumentInterface,
  ChannelInterface,
  Diagnostic,
  OperationInterface,
  SchemaInterface,
} from "@asyncapi/parser";

export class AsyncApiDocument {
  document: AsyncAPIDocumentInterface;
  diagnostics: Diagnostic[];

  constructor(
    document: AsyncAPIDocumentInterface,
    { diagnostics = [] }: { diagnostics?: Diagnostic[] } = {},
  ) {
    this.document = document;
    this.diagnostics = diagnostics;
  }

  getComponentSchemas(): SchemaInterface[] {
    return [...(this.document.components?.()?.schemas?.() ?? [])];
  }

  getOperations(): OperationInterface[] {
    return [...(this.document.operations?.() ?? [])];
  }

  getChannels(): ChannelInterface[] {
    return [...(this.document.channels?.() ?? [])];
  }
}
