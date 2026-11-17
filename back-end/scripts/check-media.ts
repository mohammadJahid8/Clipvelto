import { loadEnv } from "../src/config/env.js";
import { checkMediaTools } from "../src/services/media-tools.js";
await checkMediaTools(loadEnv());
console.log("Enabled media tools are ready.");
