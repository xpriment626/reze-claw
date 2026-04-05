# Reze LLM Chat + Ping-Pong Trigger

## Goal

Wire Reze's stubbed `/chat` endpoint to xAI's Grok model so she can have conversations and trigger a ping-pong session when asked. This proves the end-to-end flow: user → Reze (LLM) → Coral session → dashboard spectator view.

## Architecture

Reze's chat route sends user messages to Grok via the OpenAI Node SDK pointed at `https://api.x.ai/v1`. Grok has one tool available: `run_ping_pong`. When the user asks to run a ping-pong test, Grok calls the tool. Reze executes it by creating a Coral session with alpha + bravo using the existing `CoralClient.createSession()`, then feeds the result back to Grok, who responds conversationally ("Started a ping-pong session, check the dashboard"). All other messages are normal chat — Grok responds as Reze.

The `openai` SDK's `runTools()` helper handles the tool call loop automatically: stream text → detect tool call → execute our function → feed result back → stream follow-up. No manual conversation turn management.

## Components

### .env loading (`scripts/dev.sh`)

Source `.env` from the project root before starting Reze. This makes `XAI_API_KEY` (and any other vars) available to Reze via `process.env` without adding a dotenv dependency.

```bash
# Source .env if it exists
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  source "$ROOT_DIR/.env"
  set +a
fi
```

`set -a` / `set +a` marks all sourced variables for export to child processes.

### LLM client (`agents/reze/src/llm.ts`)

Thin module that creates and exports the OpenAI client configured for xAI:

```typescript
import OpenAI from "openai";

export const llm = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: "https://api.x.ai/v1",
  timeout: 120_000, // reasoning models can take longer
});

export const REZE_MODEL = "grok-4-1-fast-reasoning";
```

No class wrapper. Just the client instance and model constant. The chat route imports these directly.

### System prompt

Kept minimal — Reze is conversational but not a personality framework:

```
You are Reze, a lightweight AI gateway agent. You're friendly and concise.
You can run multi-agent workflows when asked. Right now you have one available:
a ping-pong test between two agents (Alpha and Bravo) that validates the message-passing pipeline.
When you trigger a workflow, tell the user to check the dashboard to watch it live.
```

### Tool definition

One tool, no parameters:

```typescript
{
  type: "function" as const,
  function: {
    name: "run_ping_pong",
    description: "Run a ping-pong test session between Alpha (initiator) and Bravo (responder) agents to validate the Coral message-passing pipeline.",
    parameters: { type: "object" as const, properties: {} },
    // The function implementation that runTools() calls automatically:
    function: async () => {
      const result = await coral.createSession(/* alpha + bravo session request */);
      return JSON.stringify({ sessionId: result.sessionId, namespace: result.namespace });
    },
  },
}
```

The `runTools()` helper from the OpenAI SDK calls the function when Grok emits a tool_call, feeds the return value back as a tool result, and Grok responds with a follow-up message incorporating the result.

### Chat route (`agents/reze/src/routes/chat.ts`)

Rewrite of the existing stub. Receives `CoralClient` as a dependency (passed from index.ts). Flow:

1. Parse `{ message: string }` from request body
2. Call `llm.chat.completions.runTools()` with:
   - model: `REZE_MODEL`
   - messages: system prompt + user message
   - tools: `[run_ping_pong]` with inline function
   - stream: true (implicit with runTools)
3. Stream text chunks as SSE `{ type: "text", content }` events using the `.on('content', ...)` handler
4. When complete, close the stream

The existing frontend (`WidgetView.tsx`) already reads this SSE format — no frontend changes needed.

### Index.ts change

Pass `coral` to `chatRoutes()`:

```typescript
// Before:
app.route("/", chatRoutes());
// After:
app.route("/", chatRoutes(coral));
```

### Package dependency

Add `openai` to `agents/reze/package.json`:

```json
"dependencies": {
  "openai": "^6.1.0"
}
```

## Data flow

```
User types "run a ping pong test"
  → WidgetView POST /chat { message: "run a ping pong test" }
    → chat.ts sends to Grok with run_ping_pong tool
      → Grok streams: "Sure, starting a ping-pong test..." + tool_call(run_ping_pong)
        → runTools() executes our function → coral.createSession(alpha + bravo)
          → Coral returns { sessionId, namespace }
        → runTools() feeds result back to Grok
      → Grok streams: "Session started! Check the dashboard to watch Alpha and Bravo in action."
    → SSE chunks streamed to frontend as { type: "text", content }
  → WidgetView displays Reze's response
  → User opens dashboard → existing spectator view shows live session events
```

## Files changed

| File | Action | What |
|------|--------|------|
| `agents/reze/package.json` | Modify | Add `openai` dependency |
| `agents/reze/src/llm.ts` | Create | xAI client + model constant |
| `agents/reze/src/routes/chat.ts` | Rewrite | LLM integration replaces stub |
| `agents/reze/src/index.ts` | Modify | Pass `coral` to `chatRoutes(coral)` |
| `scripts/dev.sh` | Modify | Source `.env` before starting Reze |

## What doesn't change

- Frontend (WidgetView.tsx) — already handles the SSE format
- Session routes — already handle session creation and event streaming
- Coral types — session creation request shape is already defined
- Alpha/bravo agents — unchanged, just get launched by Coral as before

## Error handling

- If `XAI_API_KEY` is not set, Reze logs a warning at startup but doesn't crash. Chat route returns a friendly error via SSE: `{ type: "text", content: "[Reze] No API key configured." }`
- If Grok API fails mid-stream, the SSE stream closes. Frontend already handles this (shows what was received).
- If Coral session creation fails inside the tool function, the error message is returned as the tool result. Grok incorporates it into the response ("Sorry, the session failed to start").

## Out of scope

- Conversation history / multi-turn memory (single request-response for now)
- Template matching / multiple workflows (just ping-pong)
- Streaming Coral events into the chat (dashboard handles this)
- Reze personality customization
