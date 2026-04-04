import { Hono } from "hono";
import type { CoralClient } from "../coral/client.js";

export function agentRoutes(coral: CoralClient) {
  const app = new Hono();

  app.get("/agents", async (c) => {
    try {
      const namespaces = await coral.listNamespaces();
      const agents = new Map<string, { name: string; version?: string; status?: string }>();

      for (const ns of namespaces) {
        for (const session of ns.sessions ?? []) {
          if (!session.id || !ns.base?.name) continue;
          try {
            const snapshot = await coral.getSession(ns.base.name, session.id);
            const agentList = Array.isArray(snapshot.agents)
              ? snapshot.agents
              : Object.values(snapshot.agents ?? {});
            for (const agent of agentList) {
              const name = agent.name ?? agent.base?.name;
              if (name && !agents.has(name)) {
                agents.set(name, {
                  name,
                  version: agent.base?.id,
                  status: agent.status?.type,
                });
              }
            }
          } catch {
            // Session may have been cleaned up
          }
        }
      }

      return c.json(Array.from(agents.values()));
    } catch (e) {
      return c.json({ error: "Failed to fetch agents" }, 500);
    }
  });

  return app;
}
