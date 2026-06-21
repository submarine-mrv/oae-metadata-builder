// Generates src/routeTree.gen.ts from src/routes/ using TanStack Router's
// generator. Used by the `build`/`routes:generate` scripts so the route tree
// exists before `tsc`. (The standalone `tsr` CLI is unusable here: its CJS
// build eagerly requires ESM-only chokidar and crashes on Node 20.)
import { Generator, getConfig } from "@tanstack/router-generator";

const root = process.cwd();
const config = getConfig({}, root);
await new Generator({ config, root }).run();
console.log("✓ Generated", config.generatedRouteTree);
