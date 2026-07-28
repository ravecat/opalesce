#!/usr/bin/env node
import { run } from "@opalesce/cli";

process.exitCode = await run(process.argv.slice(2));
