import { defineConfig, definePlugin } from "opalesce";

const metadata = definePlugin(() => ({
  name: "generate-smoke-metadata",
  build(context) {
    context.emit({
      path: "metadata/version.txt",
      contents: `${context.document.version()}\n`,
    });
  },
}));

export default defineConfig({
  input: "./asyncapi.yaml",
  output: {
    path: "./generated",
    clean: true,
  },
  plugins: [metadata()],
});
