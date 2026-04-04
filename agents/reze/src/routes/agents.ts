import { Hono } from "hono";
import type { CoralClient } from "../coral/client.js";

export function agentRoutes(coral: CoralClient) {
  const app = new Hono();

  app.get("/agents", async (c) => {
    try {
      const agents = await coral.listRegistryAgents();
      return c.json(agents);
    } catch {
      return c.json({ error: "Failed to fetch agents" }, 500);
    }
  });

  return app;
}
