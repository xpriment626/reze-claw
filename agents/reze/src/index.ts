import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { CoralClient } from "./coral/client.js";
import { CoralWebSocketRelay } from "./coral/ws.js";
import { healthRoutes } from "./routes/health.js";
import { agentRoutes } from "./routes/agents.js";
import { sessionRoutes } from "./routes/sessions.js";
import { chatRoutes } from "./routes/chat.js";

const CORAL_API_URL = process.env.CORAL_API_URL ?? "http://localhost:5555";
const CORAL_AUTH_TOKEN = process.env.CORAL_AUTH_TOKEN ?? "ligma";
const REZE_PORT = parseInt(process.env.REZE_PORT ?? "3001", 10);

const coral = new CoralClient(CORAL_API_URL, CORAL_AUTH_TOKEN);
const wsBase = CORAL_API_URL.replace(/^http/, "ws");
const wsRelay = new CoralWebSocketRelay(wsBase, CORAL_AUTH_TOKEN);

const app = new Hono();

// CORS — allow frontend dev server
app.use("*", cors({ origin: "*" }));

// Mount routes
app.route("/", healthRoutes(coral));
app.route("/", agentRoutes(coral));
app.route("/", sessionRoutes(coral, wsRelay));
app.route("/", chatRoutes(coral));

console.log(`[Reze] Gateway agent starting on port ${REZE_PORT}`);
console.log(`[Reze] Coral API: ${CORAL_API_URL}`);

serve({ fetch: app.fetch, port: REZE_PORT }, (info) => {
  console.log(`[Reze] Listening on http://localhost:${info.port}`);
});
