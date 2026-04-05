import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { CoralClient } from "../coral/client.js";
import { llm, REZE_MODEL, REZE_SYSTEM_PROMPT } from "../llm.js";
import type { CreateSessionRequest } from "@rezeclaw/coral-types/api";

function buildPingPongTool(coral: CoralClient) {
  return {
    type: "function" as const,
    function: {
      name: "run_ping_pong",
      description:
        "Run a ping-pong test session between Alpha (initiator) and Bravo (responder) agents to validate the Coral message-passing pipeline.",
      parameters: { type: "object", properties: {} },
      parse: (args: string) => JSON.parse(args) as Record<string, never>,
      function: async () => {
        const request: CreateSessionRequest = {
          agentGraphRequest: {
            agents: [
              {
                id: {
                  name: "alpha",
                  version: "0.1.0",
                  registrySourceId: { type: "local" },
                },
                name: "alpha",
                provider: { type: "local", runtime: "executable" },
                blocking: true,
              },
              {
                id: {
                  name: "bravo",
                  version: "0.1.0",
                  registrySourceId: { type: "local" },
                },
                name: "bravo",
                provider: { type: "local", runtime: "executable" },
                blocking: true,
              },
            ],
            groups: [["alpha", "bravo"]],
          },
          namespaceProvider: {
            type: "create_if_not_exists",
            namespaceRequest: {
              name: "rezeclaw",
              deleteOnLastSessionExit: false,
            },
          },
          execution: { mode: "immediate" },
        };

        try {
          const result = await coral.createSession(request);
          return JSON.stringify({
            success: true,
            sessionId: result.sessionId,
            namespace: result.namespace,
          });
        } catch (err) {
          return JSON.stringify({
            success: false,
            error: err instanceof Error ? err.message : "Session creation failed",
          });
        }
      },
    },
  };
}

export function chatRoutes(coral: CoralClient) {
  const app = new Hono();

  app.post("/chat", async (c) => {
    if (!process.env.XAI_API_KEY) {
      return streamSSE(c, async (stream) => {
        await stream.writeSSE({
          event: "message",
          data: JSON.stringify({
            type: "text",
            content: "[Reze] No API key configured. Set XAI_API_KEY in .env and restart.",
          }),
        });
      });
    }

    const body = await c.req.json<{ message: string }>();

    return streamSSE(c, async (stream) => {
      try {
        const runner = llm.chat.completions.runTools({
          model: REZE_MODEL,
          messages: [
            { role: "system", content: REZE_SYSTEM_PROMPT },
            { role: "user", content: body.message },
          ],
          tools: [buildPingPongTool(coral)],
        });

        runner.on("content", (delta) => {
          stream.writeSSE({
            event: "message",
            data: JSON.stringify({ type: "text", content: delta }),
          }).catch(() => {
            runner.abort();
          });
        });

        await runner.finalChatCompletion();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        await stream.writeSSE({
          event: "message",
          data: JSON.stringify({
            type: "text",
            content: `[Reze] Error: ${msg}`,
          }),
        });
      }
    });
  });

  return app;
}
