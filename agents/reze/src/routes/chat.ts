import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export function chatRoutes() {
  const app = new Hono();

  app.post("/chat", async (c) => {
    const body = await c.req.json<{ message: string }>();

    return streamSSE(c, async (stream) => {
      // Stubbed response — no LLM yet
      await stream.writeSSE({
        event: "message",
        data: JSON.stringify({
          type: "text",
          content: `[Reze stub] You said: "${body.message}". LLM integration coming soon.`,
        }),
      });
    });
  });

  return app;
}
