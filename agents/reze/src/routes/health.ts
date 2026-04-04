import { Hono } from "hono";
import type { CoralClient } from "../coral/client.js";

export function healthRoutes(coral: CoralClient) {
  const app = new Hono();

  app.get("/health", async (c) => {
    const coralReachable = await coral.healthCheck();
    return c.json({
      status: "ok",
      coral: coralReachable ? "connected" : "disconnected",
    });
  });

  return app;
}
