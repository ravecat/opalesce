import { writeFileSync } from "node:fs";
import { join } from "node:path";

interface CreateTempConfigOptions {
  workspace: string;
  moduleUrl: string;
  inputPath: string;
  outputPath?: string;
  pluginsSource: string;
}

export function createTempConfig({
  workspace,
  moduleUrl,
  inputPath,
  outputPath = "generated",
  pluginsSource,
}: CreateTempConfigOptions): string {
  const configPath = join(workspace, "fixture.config.mjs");

  writeFileSync(
    configPath,
    `import { asyncapi, defineConfig, typescript, zod } from ${JSON.stringify(moduleUrl)};

export default defineConfig({
  input: { path: ${JSON.stringify(inputPath)} },
  output: { path: ${JSON.stringify(outputPath)} },
  plugins: ${pluginsSource},
});
`,
  );

  return configPath;
}
