import { serve } from "@hono/node-server";
import { openCardStore } from "./cards/card-files.js";
import { describeRejection, loadDeck } from "./cards/deck.js";
import { applyEnvFile, loadConfig } from "./config.js";
import { Lives } from "./lives.js";
import { createApp } from "./server.js";

applyEnvFile();
const config = loadConfig(process.env);

const { store, rejected } = openCardStore();
for (const line of rejected.flatMap(describeRejection)) {
  console.error(`card files: rejected ${line}`);
}
const deck = await loadDeck(store);
console.log(`Cards: ${deck.cards.length} playable, ${rejected.length + deck.rejected.length} set aside.`);

const app = createApp({ config, lives: new Lives({ cards: deck.cards, types: deck.types }) });

serve({ fetch: app.fetch, hostname: "127.0.0.1", port: config.port }, (info) => {
  console.log(`Karmageddon BFF listening on http://${info.address}:${info.port}`);
});
