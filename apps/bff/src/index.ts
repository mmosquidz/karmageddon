import { serve } from "@hono/node-server";
import { applyEnvFile, loadConfig } from "./config.js";
import { createApp } from "./server.js";

applyEnvFile();
const config = loadConfig(process.env);
const app = createApp({ config });

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.port }, (info) => {
  console.log(`Karmageddon BFF listening on http://${info.address}:${info.port}`);
});
