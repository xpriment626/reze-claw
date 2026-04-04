import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { CoralClient } from "../coral/client.js";
import type { CoralWebSocketRelay } from "../coral/ws.js";
import type { CreateSessionRequest, AgentGraphEntry } from "@rezeclaw/coral-types/api";

interface SessionCreateBody {
  task: string;
  namespace?: string;
  agents: {
    name: string;
    version?: string;
    options?: Record<string, string>;
  }[];
}

export function sessionRoutes(coral: CoralClient, wsRelay: CoralWebSocketRelay) {
  const app = new Hono();

  // List all sessions across namespaces
  app.get("/sessions", async (c) => {
    try {
      const namespaces = await coral.listNamespaces();
      const sessions: {
        id: string;
        namespace: string;
        status?: string;
        timestamp?: string;
      }[] = [];

      for (const ns of namespaces) {
        for (const session of ns.sessions ?? []) {
          if (session.id) {
            sessions.push({
              id: session.id,
              namespace: ns.base?.name ?? "default",
              status: session.status?.type,
              timestamp: session.timestamp,
            });
          }
        }
      }

      return c.json(sessions);
    } catch {
      return c.json({ error: "Failed to fetch sessions" }, 500);
    }
  });

  // Create a new session
  app.post("/session", async (c) => {
    try {
      const body = await c.req.json<SessionCreateBody>();

      const agents: AgentGraphEntry[] = body.agents.map((a) => ({
        id: {
          name: a.name,
          version: a.version ?? "0.1.0",
          registrySourceId: { type: "local" as const },
        },
        name: a.name,
        provider: { type: "local" as const, runtime: "executable" as const },
        options: a.options
          ? Object.fromEntries(
              Object.entries(a.options).map(([k, v]) => [k, { type: "string", value: v }])
            )
          : undefined,
        blocking: true,
      }));

      const request: CreateSessionRequest = {
        agentGraphRequest: {
          agents,
          groups: [body.agents.map((a) => a.name)],
        },
        namespaceProvider: {
          type: "create_if_not_exists",
          namespaceRequest: {
            name: body.namespace ?? "rezeclaw",
            deleteOnLastSessionExit: false,
          },
        },
        execution: { mode: "immediate" },
      };

      const result = await coral.createSession(request);
      return c.json({
        sessionId: result.sessionId,
        namespace: result.namespace,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return c.json({ error: msg }, 500);
    }
  });

  // SSE stream of session events
  app.get("/session/:namespace/:sessionId", async (c) => {
    const { namespace, sessionId } = c.req.param();

    // First, send a snapshot of current state
    return streamSSE(c, async (stream) => {
      try {
        const snapshot = await coral.getSession(namespace, sessionId);
        await stream.writeSSE({
          event: "snapshot",
          data: JSON.stringify(snapshot),
        });
      } catch {
        await stream.writeSSE({
          event: "error",
          data: JSON.stringify({ message: "Failed to fetch session snapshot" }),
        });
      }

      // Then subscribe to live events
      const unsubscribe = wsRelay.subscribe(namespace, sessionId, (event) => {
        stream.writeSSE({
          event: "coral_event",
          data: JSON.stringify(event),
        }).catch(() => {
          // Stream closed
          unsubscribe();
        });
      });

      // Keep stream alive until client disconnects
      stream.onAbort(() => {
        unsubscribe();
      });

      // Send keepalive pings
      while (true) {
        await stream.writeSSE({ event: "ping", data: "" });
        await stream.sleep(15000);
      }
    });
  });

  // Delete a session
  app.delete("/session/:namespace/:sessionId", async (c) => {
    const { namespace, sessionId } = c.req.param();
    try {
      await coral.deleteSession(namespace, sessionId);
      return c.json({ status: "deleted" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return c.json({ error: msg }, 500);
    }
  });

  return app;
}
