# Gateway Agent + Coral Integration Design

## Overview

Connect the RezeClaw frontend to a gateway agent (Reze) that operates in two modes: direct chat and Coral multi-agent orchestration. Validate the full message-passing pipeline with deterministic dummy agents before introducing LLM reasoning.

## Architecture

### System Topology

```
┌──────────────────────────────────────────────────────┐
│  Tauri Desktop App                                   │
│  ┌────────────────┐    ┌───────────────────────────┐ │
│  │  React UI       │◄──►│  Reze (Gateway Agent)    │ │
│  │  Widget/Dash    │    │  Local Node.js process    │ │
│  │                 │    │                           │ │
│  │  - Chat panel   │    │  - Grok 4.1 LLM brain    │ │
│  │  - Agent page   │    │  - Direct chat mode       │ │
│  │  - Session page │    │  - Exa search tool        │ │
│  │  - SSE listener │    │  - Coral HTTP API client  │ │
│  └────────┬────────┘    └───────────┬──────────────┘ │
└───────────┼─────────────────────────┼────────────────┘
            │ SSE from Reze           │ HTTP + WS to Coral
            │ GET /session/:id        │ POST /api/v1/local/session
            │                         │ WS /ws/v1/events/...
            ▼                         ▼
┌──────────────────────────────────────────────────────┐
│  Coral Server (Docker, port 5555)                    │
│  - Session management, agent secret issuance         │
│  - MCP server per agent, thread/message routing      │
│  - WebSocket event broadcast                         │
│  - DockerRuntime: spawns agent containers            │
└──────┬──────────┬──────────┬──────────┬──────────────┘
       │          │          │          │
  ┌────▼────┐ ┌───▼────┐ ┌───▼─────┐ ┌───▼──────┐
  │ Alpha   │ │ Bravo  │ │ Kali    │ │ Charlie  │
  │ initiat.│ │ respond│ │ img gen │ │ reporter │
  │ Docker  │ │ Docker │ │ Docker  │ │ Docker   │
  └─────────┘ └────────┘ └─────────┘ └──────────┘
```

### Key Principle: Gateway-as-API-Client

Reze is NOT a Coral-registered agent. She uses the same HTTP API and WebSocket endpoints that any frontend would use. Only agents that need MCP tools (coral_send_message, coral_wait_for_mention, etc.) register with Coral. This keeps the local-first BYOK experience simple and mirrors the proven compliance-demo pattern.

## Reze Gateway Agent

### Runtime

- Local Node.js/TypeScript process
- Not containerized, not registered with Coral
- HTTP server on configurable port (default 3001)
- Spawned independently or as a Tauri sidecar (future)

### Modes

**Direct Chat (default):**
- User sends message via `POST /chat`
- Reze calls Grok 4.1 LLM, streams response back via SSE
- Optional tool: Exa search for web queries
- No Coral involvement

**Orchestration (triggered explicitly):**
- User requests a multi-agent task
- Reze calls Coral HTTP API to create a session with agent graph
- Reze subscribes to Coral WebSocket for session events
- Reze relays events to frontend via SSE
- Reze tears down session when complete or on user request

### API Surface

```
POST /chat            → { message: string }
                      ← SSE stream of RezeEvent

POST /session         → { task: string, agents: AgentConfig[] }
                      ← { sessionId: string, namespace: string }

GET  /session/:namespace/:sessionId   ← SSE stream of Coral events (relayed from WS)

DELETE /session/:namespace/:sessionId   → tears down Coral session

GET  /agents          ← proxied Coral agent registry
GET  /sessions        ← proxied Coral namespace/session list

GET  /health          ← { status: "ok", coral: "connected"|"disconnected" }
```

### Typed Response Events

```typescript
type RezeEvent =
  | { type: "text"; content: string }
  | { type: "session_created"; sessionId: string; namespace: string; agents: string[] }
  | { type: "coral_event"; event: CoralWebSocketEvent }
  | { type: "search_result"; results: SearchResult[] }
  | { type: "error"; message: string }
```

The frontend switches on `event.type` deterministically. Reze's LLM text goes in chat bubbles. Session activity is driven entirely by structured Coral events, never by parsing LLM output.

### Configuration (Environment Variables)

```
CORAL_API_URL=http://localhost:5555       # Coral server address
CORAL_AUTH_TOKEN=test                     # Coral config.toml auth key
REZE_PORT=3001                           # Reze HTTP server port
GROK_API_KEY=xai-...                     # BYOK for Grok 4.1
EXA_API_KEY=...                          # Optional search
REZE_AUTH_TOKEN=                          # Optional, for remote deployments
```

### Project Location

```
agents/reze/
  src/
    index.ts        # HTTP server entrypoint (Express or Hono)
    chat.ts         # Direct chat mode (Grok 4.1 + Exa)
    coral.ts        # Coral HTTP client (session CRUD + WS relay)
    types.ts        # RezeEvent, CoralEvent, shared types
  package.json
  tsconfig.json
```

## Test Agents

### Philosophy

Each agent is a fully independent project: its own directory, Dockerfile, `coral-agent.toml`, and registry entry. This mirrors how real agents are built — one agent, one purpose, one image. No shared codebase or role-switching via env vars.

### Shared Patterns

All test agents follow the same structural pattern but are independent codebases:
- `@modelcontextprotocol/sdk` for streamable HTTP transport to Coral
- Coral env vars injected by DockerRuntime: `CORAL_CONNECTION_URL`, `CORAL_AGENT_ID`, `CORAL_AGENT_SECRET`, `CORAL_SESSION_ID`, `CORAL_RUNTIME_ID`
- Connection URL: `http://host.docker.internal:5555/mcp/v1/{secret}/mcp`
- Same Dockerfile template (node:24-slim + pnpm)

### Dockerfile Template (shared pattern, each agent has its own copy)

```dockerfile
FROM node:24-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
CMD ["node", "dist/index.js"]
```

### Alpha — Initiator

Kicks off the session by creating a thread, adding participants, and sending the first message.

**`agents/alpha/coral-agent.toml`:**
```toml
edition = 3

[agent]
name = "alpha"
version = "0.1.0"
summary = "Initiator agent that creates threads and sends the opening message"

[options]

[runtimes.docker]
image = "rezeclaw/alpha:latest"
```

**`agents/alpha/src/index.ts` behavior:**
1. Connect to Coral MCP
2. Create thread
3. Add all other agents as participants
4. Send opening message with @mention to next agent
5. Wait for final response
6. Close session

```
agents/alpha/
  src/index.ts
  coral-agent.toml
  Dockerfile
  package.json
  tsconfig.json
```

### Bravo — Responder (Phase 1) / Relay (Phase 2)

**Phase 1:** Waits for mention, receives "ping", sends "pong" back.
**Phase 2:** Waits for mention, receives message, forwards to Kali with @mention.

**`agents/bravo/coral-agent.toml`:**
```toml
edition = 3

[agent]
name = "bravo"
version = "0.1.0"
summary = "Responder agent that echoes or relays messages"

[options]

[runtimes.docker]
image = "rezeclaw/bravo:latest"
```

**`agents/bravo/src/index.ts` behavior (phase 1):**
1. Connect to Coral MCP
2. `coral_wait_for_mention()`
3. Receive message
4. Send "pong" back to same thread

```
agents/bravo/
  src/index.ts
  coral-agent.toml
  Dockerfile
  package.json
  tsconfig.json
```

### Charlie — Reporter (Phase 2 only)

Waits for Kali's completion message, sends a final summary to the thread.

**`agents/charlie/coral-agent.toml`:**
```toml
edition = 3

[agent]
name = "charlie"
version = "0.1.0"
summary = "Reporter agent that confirms task completion"

[options]

[runtimes.docker]
image = "rezeclaw/charlie:latest"
```

**`agents/charlie/src/index.ts` behavior:**
1. Connect to Coral MCP
2. `coral_wait_for_mention()`
3. Receive completion message from Kali
4. Send "image generated" to thread

```
agents/charlie/
  src/index.ts
  coral-agent.toml
  Dockerfile
  package.json
  tsconfig.json
```

### Kali — Image Generator (Existing, Phase 2)

Kali already has a working `generate()` function and Dockerfile at `agents/kali/`. For phase 2, it needs:

1. MCP client connection to Coral (same pattern as other agents)
2. A `coral_wait_for_mention()` call in its entrypoint
3. On receiving a message: run hardcoded `generate("a cyberpunk cat", { aspectRatio: "1:1" })`, send result URL back to thread with @charlie mention

No changes to the core image generation logic. Just wrapping it in the Coral MCP lifecycle.

**`agents/kali/coral-agent.toml`:**
```toml
edition = 3

[agent]
name = "kali"
version = "0.1.0"
summary = "Image generation agent via Replicate API"

[options]
REPLICATE_API_TOKEN = { type = "string", required = true, secret = true }

[runtimes.docker]
image = "rezeclaw/kali:latest"
```

```
agents/kali/              # existing directory
  src/
    index.ts              # updated: MCP connect + wait loop wrapping generate()
    generate.ts           # unchanged: existing image generation logic
    env.ts                # unchanged: env file lookup
  coral-agent.toml        # new
  Dockerfile              # existing, may need minor updates
  package.json
```

## Frontend Changes

### Sidebar Navigation

Current: `[Agents, Config, Logs]` (all on one page)
New: `[Agents, Config, Sessions, Logs]` (each a separate page/route)

### Agents Page

- Fetches registered agents from Reze (which proxies Coral registry API)
- Renders each agent as a card: name, version, summary
- Read-only for now

### Sessions Page — List View

- Fetches sessions from Reze (which proxies Coral namespace API)
- Each session is a clickable card: status indicator, name, agent count, timestamp
- Status states: running (green), completed (grey), failed (red)

### Sessions Page — Detail View (Spectator)

- Click a session card → drill into spectator view
- Back button to return to list
- Header: session name, status, participating agents
- Body: chronological timeline of events and messages
  - System events (thread_created, agent_connected, runtime_started) → subtle inline markers
  - Agent messages (thread_message_sent) → prominent chat bubbles with agent name
- No user chat input in this view — spectator only
- Live updates via SSE subscription to `GET /session/:id` on Reze

### Chat Panel (Widget View)

- ChatInput posts to Reze `POST /chat`
- Responses rendered from SSE stream
- `type: "text"` → chat bubble
- `type: "session_created"` → system message with link/indicator to Sessions page
- `type: "error"` → error styling in chat

### Data Flow

All frontend data comes through Reze, never directly from Coral:

```
Frontend → Reze /chat           → LLM response (SSE)
Frontend → Reze /health         → Coral connection status
Frontend → Reze /agents         → Coral agent registry (proxied)
Frontend → Reze /sessions       → Coral namespace list (proxied)
Frontend → Reze /session/:id    → Coral WS events (relayed as SSE)
```

## Test Plan

### Phase 1: Ping-Pong

Validates basic Coral plumbing — session creation, agent registration, MCP connection, thread messaging, WebSocket events.

**Agents:** Alpha (initiator), Bravo (responder)

**Flow:**
1. User triggers session via Reze (or curl for testing)
2. Reze calls `POST /api/v1/local/session` with Alpha + Bravo
3. Coral spawns both containers
4. Alpha: creates thread → adds Bravo → sends "ping" @bravo
5. Bravo: `coral_wait_for_mention()` → receives "ping" → sends "pong"
6. Alpha: receives "pong" → closes session
7. Frontend observes all events in real-time via Sessions detail view

**Success criteria:**
- Both containers start and connect to Coral MCP
- Thread created, messages exchanged, events emitted on WebSocket
- Frontend renders agent status changes and messages in spectator view
- Session completes cleanly (containers exit, session marked complete)

### Phase 2: Chain with Image Generation

Validates multi-hop coordination with real work (image generation) happening mid-chain.

**Agents:** Alpha (initiator), Bravo (relay), Kali (executor), Charlie (reporter)

**Flow:**
1. User triggers session via Reze
2. Reze creates session with all four agents
3. Alpha: creates thread → adds all agents → sends "generate" @bravo
4. Bravo: receives → sends "generate" @kali
5. Kali: receives → runs hardcoded `generate("a cyberpunk cat", { aspectRatio: "1:1" })` → sends "done: {output_url}" @charlie
6. Charlie: receives → sends "image generated" to thread
7. Session complete

**Success criteria:**
- Four agents coordinate through a single thread
- Kali's existing image generation works inside Docker through Coral
- Messages flow correctly through the relay chain
- Frontend spectator view shows the full timeline including Kali's execution time
- Session tears down cleanly after Charlie's final message

## Deployment Portability

The architecture is deployment-agnostic. Only connection URLs change:

| Deployment | Frontend → Reze | Reze → Coral | Agent containers |
|------------|-----------------|--------------|------------------|
| Local dev  | localhost:3001  | localhost:5555 | Local Docker     |
| VPS        | https://domain/api (Caddy) | localhost:5555 (co-located) | Same-box Docker |
| Mac Mini   | https://mini.local/api | localhost:5555 | Same-box Docker |
| Managed    | https://service/api | localhost:5555 | Same-host Docker |

All config via environment variables. Optional auth middleware on Reze for remote deployments (disabled by default).

## Out of Scope

- LLM-driven intent detection (Reze deciding when to create sessions) — explicit trigger only for now
- Voice STT/TTS integration
- 3D avatar rendering
- Session persistence / history storage (Supabase)
- Agent registration from frontend ("coralise" flow)
- Config and Logs page implementation
- Production auth system for Reze
