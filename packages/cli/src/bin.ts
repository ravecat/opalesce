#!/usr/bin/env node
import { run } from "./command.js";

process.exitCode = await run(process.argv.slice(2));
