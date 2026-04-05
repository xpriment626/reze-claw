# Reze LLM Chat + Ping-Pong Trigger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Reze's `/chat` endpoint to xAI Grok so she can chat and trigger a ping-pong Coral session when asked.

**Architecture:** The `openai` npm package connects to xAI's OpenAI-compatible API at `https://api.x.ai/v1`. The chat route uses the SDK's `runTools()` helper which handles tool call loops automatically — stream text, detect tool call, execute function, feed result back, stream follow-up. One tool: `run_ping_pong` which calls `CoralClient.createSession()` with alpha + bravo.

**Tech Stack:** openai SDK v6+, Hono SSE streaming, xAI Grok `grok-4-1-fast-reasoning`

---

### Task 1: Source .env in dev.sh

**Files:**
- Modify: `scripts/dev.sh`

- [ ] **Step 1: Add .env sourcing before Reze startup**

In `scripts/dev.sh`, add the following block immediately after the `CORAL_AUTH_TOKEN` line (line 13) and before the Java detection block:

```bash
# Source .env for API keys (XAI_API_KEY, etc.)
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi
```

`set -a` marks all variables defined during `source` for automatic export to child processes. `set +a` turns it off after.

- [ ] **Step 2: Verify env loading works**

Run:
```bash
cd /Users/bambozlor/Desktop/product-lab/reze-claw
source scripts/dev.sh 2>/dev/null &
sleep 2
kill %1 2>/dev/null
```

Or simpler — just test the sourcing logic:
```bash
ROOT_DIR=/Users/bambozlor/Desktop/product-lab/reze-claw
set -a && source "$ROOT_DIR/.env" && set +a && echo "XAI_API_KEY=${XAI_API_KEY:0:10}..."
```

Expected: First 10 chars of the key printed, confirming it's loaded.

- [ ] **Step 3: Commit**

```bash
git add scripts/dev.sh
git commit -m "feat: source .env in dev.sh for API keys"
```

---

### Task 2: Add openai dependency to Reze

**Files:**
- Modify: `agents/reze/package.json`

- [ ] **Step 1: Add openai to dependencies**

In `agents/reze/package.json`, add `"openai"` to the `dependencies` object. The full dependencies block should be:

```json
"dependencies": {
    "@rezeclaw/coral-types": "workspace:*",
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0",
    "openai": "^6.1.0"
}
```

- [ ] **Step 2: Run pnpm install**

Run: `pnpm install` from the project root.

Expected: Lockfile updates, openai package installed into agents/reze/node_modules. No errors.

- [ ] **Step 3: Commit**

```bash
git add agents/reze/package.json pnpm-lock.yaml
git commit -m "feat(reze): add openai SDK dependency"
```

---

### Task 3: Create LLM client module

**Files:**
- Create: `agents/reze/src/llm.ts`

- [ ] **Step 1: Create agents/reze/src/llm.ts**

```typescript
import OpenAI from "openai";

if (!process.env.XAI_API_KEY) {
  console.warn("[Reze] WARNING: XAI_API_KEY not set — chat will be unavailable");
}

export const llm = new OpenAI({
  apiKey: process.env.XAI_API_KEY ?? "",
  baseURL: "https://api.x.ai/v1",
  timeout: 120_000,
});

export const REZE_MODEL = "grok-4-1-fast-reasoning";

export const REZE_SYSTEM_PROMPT = `You are Reze, a lightweight AI gateway agent. You're friendly and concise.
You can run multi-agent workflows when asked. Right now you have one available:
a ping-pong test between two agents (Alpha and Bravo) that validates the message-passing pipeline.
When you trigger a workflow, tell the user to check the dashboard to watch it live.`;
```

- [ ] **Step 2: Commit**

```bash
git add agents/reze/src/llm.ts
git commit -m "feat(reze): add xAI LLM client module"
```

---

### Task 4: Rewrite chat route with LLM integration

**Files:**
- Modify: `agents/reze/src/routes/chat.ts`
- Modify: `agents/reze/src/index.ts`

This is the core task. The chat route receives the user message, sends it to Grok with the `run_ping_pong` tool, and streams the response as SSE events in the format `{ type: "text", content }` that the frontend already parses.

- [ ] **Step 1: Rewrite agents/reze/src/routes/chat.ts**

Replace the entire file with:

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { CoralClient } from "../coral/client.js";
import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction.js";
import { llm, REZE_MODEL, REZE_SYSTEM_PROMPT } from "../llm.js";
import type { CreateSessionRequest } from "@rezeclaw/coral-types/api";

function buildPingPongTool(coral: CoralClient): RunnableToolFunctionWithParse<Record<string, never>> {
  return {
    type: "function",
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
```

Key details:
- `buildPingPongTool()` creates the tool definition with the Coral session creation logic inline. The `parse` function and typed generics satisfy the `RunnableToolFunctionWithParse` interface required by `runTools()`.
- `runner.on("content", delta => ...)` fires for each text token streamed from Grok. We immediately write it as an SSE event.
- If the stream is aborted by the client (frontend navigates away), the `.catch()` on `writeSSE` calls `runner.abort()` to stop the Grok request.
- If Coral session creation fails, the error is returned as the tool result string. Grok incorporates it into a natural response.
- The `import type { RunnableToolFunctionWithParse }` may need to be adjusted based on the exact export path in openai v6. If the import fails, try `import type { RunnableToolFunctionWithParse } from "openai/lib/RunnableFunction"` (without `.js`).

- [ ] **Step 2: Update agents/reze/src/index.ts to pass coral to chatRoutes**

Change line 29 from:

```typescript
app.route("/", chatRoutes());
```

to:

```typescript
app.route("/", chatRoutes(coral));
```

The `chatRoutes` function signature now requires a `CoralClient` argument.

- [ ] **Step 3: Verify TypeScript compiles**

Run from agents/reze/:
```bash
cd agents/reze && npx tsc --noEmit
```

Expected: No errors. If there are import path issues with the openai types, adjust the `RunnableToolFunctionWithParse` import path based on the actual package structure.

- [ ] **Step 4: Commit**

```bash
git add agents/reze/src/routes/chat.ts agents/reze/src/index.ts
git commit -m "feat(reze): wire chat route to xAI Grok with ping-pong tool"
```

---

### Task 5: Smoke test

- [ ] **Step 1: Start the full stack**

Run: `pnpm dev:all`

Expected: All three services start (Coral, Reze, Tauri). Check logs for:
- `[Reze] Gateway agent starting on port 3001`
- No "XAI_API_KEY not set" warning

- [ ] **Step 2: Test basic chat**

Open the Tauri app (or curl):

```bash
curl -N -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hey Reze, what can you do?"}'
```

Expected: SSE stream of text events with Reze responding conversationally, mentioning she can run a ping-pong test.

- [ ] **Step 3: Test ping-pong trigger**

```bash
curl -N -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Run a ping pong test"}'
```

Expected:
1. SSE text events with Reze acknowledging ("Starting a ping-pong test...")
2. Tool call executes — Coral session created with alpha + bravo
3. More SSE text events with Reze confirming ("Session started, check the dashboard...")
4. Verify session appears in dashboard at `http://localhost:5555/ui/console` or via `curl http://localhost:3001/sessions`

- [ ] **Step 4: Test missing API key gracefully**

Stop the server. Temporarily unset XAI_API_KEY and start Reze manually:

```bash
cd agents/reze
CORAL_API_URL=http://localhost:5555 CORAL_AUTH_TOKEN=ligma npx tsx src/index.ts &
curl -N -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```

Expected: SSE response with `[Reze] No API key configured. Set XAI_API_KEY in .env and restart.`

Kill the test server: `pkill -f "tsx.*reze"`

- [ ] **Step 5: Commit any fixes from smoke testing**

```bash
git add -A
git commit -m "fix: adjustments from LLM chat smoke testing"
```
