import { defineConfig, definePlugin } from "opalesce";

const asyncAPISummary = definePlugin(() => ({
  name: "asyncapi-summary",
  build(context) {
    const info = context.document.info();
    const channels = context.document.channels().all();
    const operations = context.document.operations().all();
    const contents = [
      `# ${info.title()}`,
      "",
      `- AsyncAPI document: ${context.document.version()}`,
      `- API version: ${info.version()}`,
      `- Channels: ${channels.length}`,
      `- Operations: ${operations.length}`,
      "",
      "## Channels",
      "",
      ...channels.map(
        (channel) => `- \`${channel.id()}\` -> \`${channel.address() ?? "<anonymous>"}\``,
      ),
      "",
      "## Operations",
      "",
      ...operations.map(
        (operation) => `- \`${operation.id() ?? "<anonymous>"}\` -> \`${operation.action()}\``,
      ),
      "",
    ].join("\n");

    context.emit({
      path: "asyncapi-summary.md",
      contents,
    });
  },
}));

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
    clean: true,
  },
  plugins: [asyncAPISummary()],
});
