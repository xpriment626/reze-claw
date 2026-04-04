# Gateway + Coral Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up Reze gateway agent, Alpha/Bravo/Charlie test agents, and frontend dashboard to validate end-to-end message passing through Coral.

**Architecture:** Reze is a local HTTP server (Hono) that proxies Coral's REST/WS APIs and serves as the frontend's single backend. Test agents are independent Docker containers that connect to Coral via MCP streamable HTTP. Frontend uses SSE from Reze for real-time session events.

**Tech Stack:** TypeScript, Hono (Reze HTTP server), @modelcontextprotocol/sdk (agent MCP client), React 19, react-router-dom 7, Tailwind CSS 4, Docker

**Spec:** `docs/superpowers/specs/2026-04-03-gateway-coral-integration-design.md`

---

## File Structure

### Reze Gateway (`agents/reze/`)

```
agents/reze/
  src/
    index.ts          # Hono HTTP server entrypoint, mounts all routes
    routes/
      chat.ts         # POST /chat — stubbed SSE response (no LLM yet)
      health.ts       # GET /health — Coral connectivity check
      agents.ts       # GET /agents — proxy Coral agent registry
      sessions.ts     # GET /sessions, POST /session, GET /session/:id (SSE), DELETE /session/:id
    coral/
      client.ts       # Coral HTTP API client (session CRUD, namespace list, agent registry)
      ws.ts           # Coral WebSocket subscriber (connects to event stream, emits to listeners)
      types.ts        # Coral API request/response types
    types.ts          # RezeEvent and shared types
  package.json
  tsconfig.json
```

### Alpha Agent (`agents/alpha/`)

```
agents/alpha/
  src/
    index.ts          # Entrypoint: connect MCP, create thread, send ping, wait, close
    mcp.ts            # MCP client setup (streamable HTTP transport)
  coral-agent.toml
  Dockerfile
  package.json
  tsconfig.json
```

### Bravo Agent (`agents/bravo/`)

```
agents/bravo/
  src/
    index.ts          # Entrypoint: connect MCP, wait for mention, send pong
    mcp.ts            # MCP client setup (same pattern as alpha)
  coral-agent.toml
  Dockerfile
  package.json
  tsconfig.json
```

### Charlie Agent (`agents/charlie/`)

```
agents/charlie/
  src/
    index.ts          # Entrypoint: connect MCP, wait for mention, send confirmation
    mcp.ts            # MCP client setup (same pattern)
  coral-agent.toml
  Dockerfile
  package.json
  tsconfig.json
```

### Kali Agent (`agents/kali/` — existing, modified)

```
agents/kali/
  src/
    index.ts          # MODIFIED: add MCP connect + wait-for-mention loop wrapping generate()
    generate.ts       # UNCHANGED
    env.ts            # UNCHANGED
    mcp.ts            # NEW: MCP client setup (same pattern)
  coral-agent.toml    # NEW
  Dockerfile          # EXISTING (minor update: build step)
  package.json        # MODIFIED: add @modelcontextprotocol/sdk
```

### Frontend (`src/` — existing, modified)

```
src/
  App.tsx                               # MODIFIED: add react-router routes
  components/
    dashboard/
      DashboardView.tsx                 # MODIFIED: render active route instead of AgentsPanel
      Sidebar.tsx                       # MODIFIED: add Sessions tab, wire to routes
      AgentsPanel.tsx                   # MODIFIED: fetch from Reze /agents instead of mock data
      SessionsPanel.tsx                 # NEW: session list view
      SessionDetailView.tsx             # NEW: spectator view (SSE-driven)
    widget/
      WidgetView.tsx                    # MODIFIED: wire ChatInput to Reze /chat
      ChatInput.tsx                     # UNCHANGED
  shared/
    use-reze.ts                         # NEW: hook for Reze HTTP client (fetch agents, sessions, chat)
```

---

## Phase 1: Ping-Pong

### Task 1: Reze Gateway — Scaffold & Types

**Files:**
- Create: `agents/reze/package.json`
- Create: `agents/reze/tsconfig.json`
- Create: `agents/reze/src/types.ts`
- Create: `agents/reze/src/coral/types.ts`

- [ ] **Step 1: Create `agents/reze/package.json`**

```json
{
  "name": "@rezeclaw/gateway-reze",
  "version": "0.1.0",
  "private": true,
  "description": "Reze — RezeClaw gateway agent",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@hono/node-server": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `agents/reze/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `agents/reze/src/types.ts`**

These are the typed events that Reze sends to the frontend over SSE.

```typescript
// Events sent from Reze to the frontend via SSE
export type RezeEvent =
  | { type: "text"; content: string }
  | { type: "session_created"; sessionId: string; namespace: string; agents: string[] }
  | { type: "coral_event"; event: CoralWebSocketEvent }
  | { type: "error"; message: string };

// Coral WebSocket events relayed through Reze
export interface CoralWebSocketEvent {
  type: string;
  name?: string;
  threadId?: string;
  thread?: CoralThread;
  message?: CoralMessage;
  timestamp?: string;
}

export interface CoralThread {
  id: string;
  participants?: string[];
  messages?: CoralMessage[];
}

export interface CoralMessage {
  id?: string;
  senderName: string;
  text: string;
  timestamp?: string;
  threadId?: string;
  mentionNames?: string[];
}

export interface CoralAgent {
  name: string;
  version?: string;
  summary?: string;
  status?: { type: string };
}

export interface CoralSession {
  id: string;
  namespace: string;
  status?: { type: string };
  timestamp?: string;
  agents?: CoralAgent[];
}
```

- [ ] **Step 4: Create `agents/reze/src/coral/types.ts`**

These types model Coral's HTTP API request/response shapes.

```typescript
// POST /api/v1/local/session request body
export interface CreateSessionRequest {
  agentGraphRequest: {
    agents: AgentGraphEntry[];
    groups: string[][];
    customTools?: Record<string, unknown>;
  };
  namespaceProvider: {
    type: "create_if_not_exists";
    namespaceRequest: {
      name: string;
      deleteOnLastSessionExit: boolean;
      annotations?: Record<string, unknown>;
    };
  };
  execution: {
    mode: "immediate";
    runtimeSettings?: Record<string, unknown>;
  };
  annotations?: Record<string, unknown>;
}

export interface AgentGraphEntry {
  id: { name: string; version: string; source: string };
  name: string;
  provider?: Record<string, unknown>;
  options?: Record<string, { type: string; value: string }>;
  systemPrompt?: string;
  blocking?: boolean;
  customToolAccess?: unknown[];
  plugins?: unknown[];
  x402Budgets?: unknown[];
  annotations?: Record<string, unknown>;
}

// POST /api/v1/local/session response
export interface CreateSessionResponse {
  sessionId: string;
  namespace: string;
}

// GET /api/v1/local/namespace/extended response
export interface NamespaceState {
  base?: { name?: string };
  sessions?: NamespaceSession[];
}

export interface NamespaceSession {
  id?: string;
  timestamp?: string;
  status?: { type?: string };
}

// GET /api/v1/local/session/{ns}/{id}/extended response
export interface SessionSnapshot {
  agents?: Record<string, SessionAgent> | SessionAgent[];
  threads?: SessionThread[];
}

export interface SessionAgent {
  name?: string;
  id?: string;
  base?: { id?: string; name?: string };
  links?: string[];
  status?: { type?: string };
}

export interface SessionThread {
  id?: string;
  participants?: string[];
  messages?: SessionMessage[];
}

export interface SessionMessage {
  id?: string;
  senderName?: string;
  text?: string;
  timestamp?: string;
  threadId?: string;
  mentionNames?: string[];
}
```

- [ ] **Step 5: Install dependencies**

Run: `cd agents/reze && pnpm install`

- [ ] **Step 6: Commit**

```bash
git add agents/reze/package.json agents/reze/tsconfig.json agents/reze/src/types.ts agents/reze/src/coral/types.ts agents/reze/pnpm-lock.yaml
git commit -m "feat(reze): scaffold gateway agent with types"
```

---

### Task 2: Reze Gateway — Coral HTTP Client

**Files:**
- Create: `agents/reze/src/coral/client.ts`

- [ ] **Step 1: Create `agents/reze/src/coral/client.ts`**

This module wraps all Coral REST API calls. Every function takes the base URL and auth token so it stays stateless.

```typescript
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  NamespaceState,
  SessionSnapshot,
} from "./types.js";

export class CoralClient {
  constructor(
    private baseUrl: string,
    private authToken: string
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.authToken}`,
      "Content-Type": "application/json",
    };
  }

  /** List all namespaces with their sessions */
  async listNamespaces(): Promise<NamespaceState[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/local/namespace/extended`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Coral namespace list failed: ${res.status}`);
    return res.json();
  }

  /** Get extended session state (agents, threads, messages) */
  async getSession(namespace: string, sessionId: string): Promise<SessionSnapshot> {
    const ns = encodeURIComponent(namespace);
    const sid = encodeURIComponent(sessionId);
    const res = await fetch(
      `${this.baseUrl}/api/v1/local/session/${ns}/${sid}/extended`,
      { headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Coral session fetch failed: ${res.status}`);
    return res.json();
  }

  /** Create a new session with an agent graph */
  async createSession(request: CreateSessionRequest): Promise<CreateSessionResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/local/session`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Coral session create failed: ${res.status} — ${body}`);
    }
    return res.json();
  }

  /** Delete (teardown) a session */
  async deleteSession(namespace: string, sessionId: string): Promise<void> {
    const ns = encodeURIComponent(namespace);
    const sid = encodeURIComponent(sessionId);
    const res = await fetch(
      `${this.baseUrl}/api/v1/local/session/${ns}/${sid}`,
      { method: "DELETE", headers: this.headers() }
    );
    if (!res.ok) throw new Error(`Coral session delete failed: ${res.status}`);
  }

  /** Check if Coral server is reachable */
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/v1/local/namespace`, {
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd agents/reze && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add agents/reze/src/coral/client.ts
git commit -m "feat(reze): add Coral HTTP API client"
```

---

### Task 3: Reze Gateway — WebSocket Relay

**Files:**
- Create: `agents/reze/src/coral/ws.ts`

- [ ] **Step 1: Create `agents/reze/src/coral/ws.ts`**

This module connects to Coral's WebSocket and emits parsed events to registered listeners. Used by the `/session/:id` SSE endpoint to relay events to the frontend.

```typescript
import type { CoralWebSocketEvent } from "../types.js";

type EventListener = (event: CoralWebSocketEvent) => void;

export class CoralWebSocketRelay {
  private sockets = new Map<string, WebSocket>();
  private listeners = new Map<string, Set<EventListener>>();

  constructor(
    private wsBase: string,
    private authToken: string
  ) {}

  /** Build the WS URL for a session */
  private buildUrl(namespace: string, sessionId: string): string {
    const ns = encodeURIComponent(namespace);
    const sid = encodeURIComponent(sessionId);
    const token = encodeURIComponent(this.authToken);
    return `${this.wsBase}/ws/v1/events/${token}/session/${ns}/${sid}`;
  }

  /** Get a unique key for a session */
  private key(namespace: string, sessionId: string): string {
    return `${namespace}/${sessionId}`;
  }

  /** Subscribe to events for a session. Returns an unsubscribe function. */
  subscribe(
    namespace: string,
    sessionId: string,
    listener: EventListener
  ): () => void {
    const k = this.key(namespace, sessionId);

    // Register listener
    if (!this.listeners.has(k)) {
      this.listeners.set(k, new Set());
    }
    this.listeners.get(k)!.add(listener);

    // Connect WebSocket if not already connected for this session
    if (!this.sockets.has(k)) {
      this.connect(namespace, sessionId, k);
    }

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(k);
      if (set) {
        set.delete(listener);
        // If no more listeners, close the socket
        if (set.size === 0) {
          this.listeners.delete(k);
          const ws = this.sockets.get(k);
          if (ws) {
            ws.close();
            this.sockets.delete(k);
          }
        }
      }
    };
  }

  private connect(namespace: string, sessionId: string, key: string): void {
    const url = this.buildUrl(namespace, sessionId);
    const ws = new WebSocket(url);

    ws.onmessage = (evt) => {
      try {
        const event: CoralWebSocketEvent = JSON.parse(
          typeof evt.data === "string" ? evt.data : evt.data.toString()
        );
        const set = this.listeners.get(key);
        if (set) {
          for (const listener of set) {
            listener(event);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      this.sockets.delete(key);
      // Reconnect if there are still listeners
      if (this.listeners.has(key) && this.listeners.get(key)!.size > 0) {
        setTimeout(() => {
          if (this.listeners.has(key) && this.listeners.get(key)!.size > 0) {
            this.connect(namespace, sessionId, key);
          }
        }, 2500);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };

    this.sockets.set(key, ws);
  }

  /** Close all connections */
  closeAll(): void {
    for (const ws of this.sockets.values()) {
      ws.close();
    }
    this.sockets.clear();
    this.listeners.clear();
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd agents/reze && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add agents/reze/src/coral/ws.ts
git commit -m "feat(reze): add Coral WebSocket relay for session events"
```

---

### Task 4: Reze Gateway — HTTP Server & Routes

**Files:**
- Create: `agents/reze/src/index.ts`
- Create: `agents/reze/src/routes/health.ts`
- Create: `agents/reze/src/routes/agents.ts`
- Create: `agents/reze/src/routes/sessions.ts`
- Create: `agents/reze/src/routes/chat.ts`

- [ ] **Step 1: Create `agents/reze/src/routes/health.ts`**

```typescript
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
```

- [ ] **Step 2: Create `agents/reze/src/routes/agents.ts`**

For now, this proxies the Coral namespace/session API and extracts agent info from active sessions. If a dedicated Coral registry endpoint exists, this can be updated.

```typescript
import { Hono } from "hono";
import type { CoralClient } from "../coral/client.js";

export function agentRoutes(coral: CoralClient) {
  const app = new Hono();

  app.get("/agents", async (c) => {
    try {
      // Coral doesn't have a public agent registry REST endpoint.
      // We get agent info from active sessions. For a richer view,
      // the Coral console UI reads the registry directly — we may
      // add a proxy for that later.
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
```

- [ ] **Step 3: Create `agents/reze/src/routes/sessions.ts`**

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { CoralClient } from "../coral/client.js";
import type { CoralWebSocketRelay } from "../coral/ws.js";
import type { CreateSessionRequest, AgentGraphEntry } from "../coral/types.js";

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
        id: { name: a.name, version: a.version ?? "0.1.0", source: "local" },
        name: a.name,
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
```

- [ ] **Step 4: Create `agents/reze/src/routes/chat.ts`**

Stubbed for now — no LLM. Just echoes back a test response via SSE.

```typescript
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
```

- [ ] **Step 5: Create `agents/reze/src/index.ts`**

```typescript
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
const CORAL_AUTH_TOKEN = process.env.CORAL_AUTH_TOKEN ?? "test";
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
app.route("/", chatRoutes());

console.log(`[Reze] Gateway agent starting on port ${REZE_PORT}`);
console.log(`[Reze] Coral API: ${CORAL_API_URL}`);

serve({ fetch: app.fetch, port: REZE_PORT }, (info) => {
  console.log(`[Reze] Listening on http://localhost:${info.port}`);
});
```

- [ ] **Step 6: Verify it compiles**

Run: `cd agents/reze && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Test the server starts**

Run: `cd agents/reze && npx tsx src/index.ts &`

Then in a separate check:
Run: `curl http://localhost:3001/health`
Expected: `{"status":"ok","coral":"disconnected"}` (since Coral isn't running yet)

Kill the server after verifying.

- [ ] **Step 8: Commit**

```bash
git add agents/reze/src/
git commit -m "feat(reze): add HTTP server with health, agents, sessions, and chat routes"
```

---

### Task 5: Alpha Agent

**Files:**
- Create: `agents/alpha/package.json`
- Create: `agents/alpha/tsconfig.json`
- Create: `agents/alpha/coral-agent.toml`
- Create: `agents/alpha/Dockerfile`
- Create: `agents/alpha/src/mcp.ts`
- Create: `agents/alpha/src/index.ts`

- [ ] **Step 1: Create `agents/alpha/package.json`**

```json
{
  "name": "@rezeclaw/agent-alpha",
  "version": "0.1.0",
  "private": true,
  "description": "Alpha — initiator test agent",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `agents/alpha/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `agents/alpha/coral-agent.toml`**

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

- [ ] **Step 4: Create `agents/alpha/Dockerfile`**

```dockerfile
FROM node:22-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build
CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Create `agents/alpha/src/mcp.ts`**

Shared MCP client setup pattern. Each agent has its own copy.

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function connectMcp(agentName: string): Promise<Client> {
  const connectionUrl = process.env.CORAL_CONNECTION_URL;
  if (!connectionUrl) {
    throw new Error("CORAL_CONNECTION_URL not set");
  }

  console.log(`[${agentName}] Connecting to Coral MCP at ${connectionUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(connectionUrl));
  const client = new Client(
    { name: agentName, version: "0.1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log(`[${agentName}] MCP connected`);

  return client;
}

export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const result = await client.callTool({ name: toolName, arguments: args });
  // MCP tool results come as content array — extract text
  if (result.content && Array.isArray(result.content)) {
    const textParts = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text);
    if (textParts.length === 1) {
      try {
        return JSON.parse(textParts[0]);
      } catch {
        return textParts[0];
      }
    }
    return textParts.join("\n");
  }
  return result;
}
```

- [ ] **Step 6: Create `agents/alpha/src/index.ts`**

Alpha is the initiator: creates a thread with bravo, sends "ping", waits for response, then closes the session.

```typescript
import { connectMcp, callTool } from "./mcp.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "alpha";

async function main() {
  console.log(`[${AGENT_NAME}] Starting initiator agent`);

  const client = await connectMcp(AGENT_NAME);

  // Step 1: Create a thread
  console.log(`[${AGENT_NAME}] Creating thread...`);
  const threadResult = await callTool(client, "coral_create_thread", {}) as {
    threadId: string;
    status: string;
  };
  const threadId = threadResult.threadId;
  console.log(`[${AGENT_NAME}] Thread created: ${threadId}`);

  // Step 2: Add bravo to the thread
  console.log(`[${AGENT_NAME}] Adding bravo to thread...`);
  await callTool(client, "coral_add_participant", {
    threadId,
    agentName: "bravo",
  });

  // Step 3: Send "ping" mentioning bravo
  console.log(`[${AGENT_NAME}] Sending ping...`);
  await callTool(client, "coral_send_message", {
    threadId,
    content: "ping",
    mentions: ["bravo"],
  });

  // Step 4: Wait for bravo's response
  console.log(`[${AGENT_NAME}] Waiting for response...`);
  const response = await callTool(client, "coral_wait_for_message", {}) as {
    message?: { senderName: string; text: string };
    status: string;
  };

  if (response.message) {
    console.log(
      `[${AGENT_NAME}] Received from ${response.message.senderName}: ${response.message.text}`
    );
  } else {
    console.log(`[${AGENT_NAME}] No response received (status: ${response.status})`);
  }

  // Step 5: Close the session
  console.log(`[${AGENT_NAME}] Closing session...`);
  await callTool(client, "coral_close_session", {});
  console.log(`[${AGENT_NAME}] Done.`);
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal error:`, err);
  process.exit(1);
});
```

- [ ] **Step 7: Install dependencies and verify compilation**

Run: `cd agents/alpha && pnpm install && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Build Docker image**

Run: `cd agents/alpha && docker build -t rezeclaw/alpha:latest .`
Expected: Image builds successfully

- [ ] **Step 9: Commit**

```bash
git add agents/alpha/
git commit -m "feat(alpha): add initiator test agent"
```

---

### Task 6: Bravo Agent

**Files:**
- Create: `agents/bravo/package.json`
- Create: `agents/bravo/tsconfig.json`
- Create: `agents/bravo/coral-agent.toml`
- Create: `agents/bravo/Dockerfile`
- Create: `agents/bravo/src/mcp.ts`
- Create: `agents/bravo/src/index.ts`

- [ ] **Step 1: Create `agents/bravo/package.json`**

```json
{
  "name": "@rezeclaw/agent-bravo",
  "version": "0.1.0",
  "private": true,
  "description": "Bravo — responder test agent",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `agents/bravo/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `agents/bravo/coral-agent.toml`**

```toml
edition = 3

[agent]
name = "bravo"
version = "0.1.0"
summary = "Responder agent that echoes messages back"

[options]

[runtimes.docker]
image = "rezeclaw/bravo:latest"
```

- [ ] **Step 4: Create `agents/bravo/Dockerfile`**

```dockerfile
FROM node:22-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build
CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Create `agents/bravo/src/mcp.ts`**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function connectMcp(agentName: string): Promise<Client> {
  const connectionUrl = process.env.CORAL_CONNECTION_URL;
  if (!connectionUrl) {
    throw new Error("CORAL_CONNECTION_URL not set");
  }

  console.log(`[${agentName}] Connecting to Coral MCP at ${connectionUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(connectionUrl));
  const client = new Client(
    { name: agentName, version: "0.1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log(`[${agentName}] MCP connected`);

  return client;
}

export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const result = await client.callTool({ name: toolName, arguments: args });
  if (result.content && Array.isArray(result.content)) {
    const textParts = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text);
    if (textParts.length === 1) {
      try {
        return JSON.parse(textParts[0]);
      } catch {
        return textParts[0];
      }
    }
    return textParts.join("\n");
  }
  return result;
}
```

- [ ] **Step 6: Create `agents/bravo/src/index.ts`**

Bravo waits for a mention, then sends "pong" back.

```typescript
import { connectMcp, callTool } from "./mcp.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "bravo";

async function main() {
  console.log(`[${AGENT_NAME}] Starting responder agent`);

  const client = await connectMcp(AGENT_NAME);

  // Step 1: Wait for someone to mention us
  console.log(`[${AGENT_NAME}] Waiting for mention...`);
  const incoming = await callTool(client, "coral_wait_for_mention", {}) as {
    message?: { senderName: string; text: string; threadId: string };
    status: string;
  };

  if (!incoming.message) {
    console.log(`[${AGENT_NAME}] No message received (status: ${incoming.status})`);
    return;
  }

  console.log(
    `[${AGENT_NAME}] Received from ${incoming.message.senderName}: ${incoming.message.text}`
  );

  // Step 2: Send "pong" back on the same thread
  console.log(`[${AGENT_NAME}] Sending pong...`);
  await callTool(client, "coral_send_message", {
    threadId: incoming.message.threadId,
    content: "pong",
    mentions: [incoming.message.senderName],
  });

  console.log(`[${AGENT_NAME}] Done.`);
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal error:`, err);
  process.exit(1);
});
```

- [ ] **Step 7: Install dependencies and verify compilation**

Run: `cd agents/bravo && pnpm install && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Build Docker image**

Run: `cd agents/bravo && docker build -t rezeclaw/bravo:latest .`
Expected: Image builds successfully

- [ ] **Step 9: Commit**

```bash
git add agents/bravo/
git commit -m "feat(bravo): add responder test agent"
```

---

### Task 7: Frontend — Routing & Sidebar Refactor

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/dashboard/DashboardView.tsx`
- Modify: `src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Update `src/App.tsx` to add routing**

The app needs `react-router-dom` for dashboard page navigation. Widget mode stays as-is. Dashboard mode gets route-based content.

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WidgetView } from "./components/widget/WidgetView";
import { DashboardView } from "./components/dashboard/DashboardView";
import { useAppMode } from "./shared/use-app-mode";

export default function App() {
  const { mode, expand, collapse } = useAppMode();

  if (mode === "dashboard") {
    return (
      <BrowserRouter>
        <DashboardView onCollapse={collapse} />
      </BrowserRouter>
    );
  }

  return <WidgetView onExpand={expand} />;
}
```

- [ ] **Step 2: Update `src/components/dashboard/Sidebar.tsx`**

Add "Sessions" tab and wire navigation to react-router links.

```typescript
import { useNavigate, useLocation } from "react-router-dom";
import { startDragging } from "@/shared/tauri";

interface SidebarProps {
  onCollapse: () => void;
}

type Tab = "agents" | "config" | "sessions" | "logs";

const tabs: { id: Tab; label: string; path: string }[] = [
  { id: "agents", label: "Agents", path: "/agents" },
  { id: "config", label: "Config", path: "/config" },
  { id: "sessions", label: "Sessions", path: "/sessions" },
  { id: "logs", label: "Logs", path: "/logs" },
];

export function Sidebar({ onCollapse }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = tabs.find((t) => location.pathname.startsWith(t.path))?.id ?? "agents";

  const handleDragStart = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    try {
      await startDragging();
    } catch {
      // browser dev mode
    }
  };

  return (
    <div className="w-48 bg-claw-900 border-r border-claw-700/50 flex flex-col">
      {/* Header with collapse button */}
      <div
        onMouseDown={handleDragStart}
        className="flex items-center justify-between px-3 py-3 border-b border-claw-700/50 cursor-grab active:cursor-grabbing"
      >
        <span className="text-xs font-medium text-claw-400 tracking-wider uppercase pointer-events-none select-none">
          RezeClaw
        </span>
        <button
          onClick={onCollapse}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-claw-700 transition-colors text-claw-400 hover:text-claw-100"
          title="Collapse to widget"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M9 3L6 6L3 3" />
            <path d="M9 7L6 10L3 7" />
          </svg>
        </button>
      </div>

      {/* Navigation tabs */}
      <nav className="flex-1 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.path)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? "text-claw-100 bg-claw-800"
                : "text-claw-400 hover:text-claw-200 hover:bg-claw-800/50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Status footer */}
      <div className="px-3 py-3 border-t border-claw-700/50">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-claw-500" />
          <span className="text-[10px] text-claw-500">Coral: disconnected</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update `src/components/dashboard/DashboardView.tsx`**

Replace hardcoded `<AgentsPanel />` with `<Routes>`.

```typescript
import { Routes, Route, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { AgentsPanel } from "./AgentsPanel";
import { SessionsPanel } from "./SessionsPanel";
import { SessionDetailView } from "./SessionDetailView";
import { SceneView } from "../widget/SceneView";
import { ChatInput } from "../widget/ChatInput";

interface DashboardViewProps {
  onCollapse: () => void;
}

export function DashboardView({ onCollapse }: DashboardViewProps) {
  const handleSend = (message: string) => {
    console.log("[RezeClaw] User:", message);
  };

  return (
    <div className="h-screen flex">
      <Sidebar onCollapse={onCollapse} />

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Widget preview (left) */}
        <div className="w-80 flex flex-col border-r border-claw-700/50">
          <SceneView />
          <ChatInput onSend={handleSend} />
        </div>

        {/* Dashboard panels (right) — routed */}
        <div className="flex-1 bg-claw-950 overflow-y-auto">
          <Routes>
            <Route path="/agents" element={<AgentsPanel />} />
            <Route path="/config" element={<Placeholder label="Config" />} />
            <Route path="/sessions" element={<SessionsPanel />} />
            <Route path="/sessions/:namespace/:sessionId" element={<SessionDetailView />} />
            <Route path="/logs" element={<Placeholder label="Logs" />} />
            <Route path="*" element={<Navigate to="/agents" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-claw-100 mb-1">{label}</h2>
      <p className="text-sm text-claw-500">Coming soon</p>
    </div>
  );
}
```

- [ ] **Step 4: Verify the app compiles**

Run: `cd /Users/bambozlor/Desktop/product-lab/reze-claw && pnpm build`
Expected: Build succeeds (SessionsPanel and SessionDetailView don't exist yet — create empty stubs to unblock)

Create temporary stubs:

`src/components/dashboard/SessionsPanel.tsx`:
```typescript
export function SessionsPanel() {
  return <div className="p-6"><h2 className="text-lg font-medium text-claw-100">Sessions</h2></div>;
}
```

`src/components/dashboard/SessionDetailView.tsx`:
```typescript
export function SessionDetailView() {
  return <div className="p-6"><h2 className="text-lg font-medium text-claw-100">Session Detail</h2></div>;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/dashboard/DashboardView.tsx src/components/dashboard/Sidebar.tsx src/components/dashboard/SessionsPanel.tsx src/components/dashboard/SessionDetailView.tsx
git commit -m "feat(frontend): add routing, Sessions tab, and page structure"
```

---

### Task 8: Frontend — Reze Client Hook

**Files:**
- Create: `src/shared/use-reze.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add Reze proxy to `vite.config.ts`**

So the frontend can call `/api/...` in dev mode and have it forwarded to Reze on port 3001.

Add a `proxy` section to the existing server config:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/reze": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/reze/, ""),
      },
    },
  },
});
```

- [ ] **Step 2: Create `src/shared/use-reze.ts`**

React hook for all Reze API interactions. Handles agents, sessions, and SSE subscriptions.

```typescript
import { useState, useEffect, useCallback, useRef } from "react";

const REZE_BASE = "/reze";

// --- Types ---

export interface RezeAgent {
  name: string;
  version?: string;
  status?: string;
}

export interface RezeSession {
  id: string;
  namespace: string;
  status?: string;
  timestamp?: string;
}

export interface RezeSessionSnapshot {
  agents?: Record<string, unknown> | unknown[];
  threads?: {
    id?: string;
    participants?: string[];
    messages?: {
      id?: string;
      senderName?: string;
      text?: string;
      timestamp?: string;
      threadId?: string;
      mentionNames?: string[];
    }[];
  }[];
}

export interface CoralEvent {
  type: string;
  name?: string;
  threadId?: string;
  message?: {
    senderName?: string;
    text?: string;
    timestamp?: string;
    threadId?: string;
    mentionNames?: string[];
  };
  timestamp?: string;
}

// --- Health ---

export function useRezeHealth() {
  const [status, setStatus] = useState<{ status: string; coral: string } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${REZE_BASE}/health`);
        setStatus(await res.json());
      } catch {
        setStatus(null);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

// --- Agents ---

export function useAgents() {
  const [agents, setAgents] = useState<RezeAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${REZE_BASE}/agents`);
      if (res.ok) setAgents(await res.json());
    } catch {
      // Reze not running
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { agents, loading, refresh };
}

// --- Sessions ---

export function useSessions() {
  const [sessions, setSessions] = useState<RezeSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${REZE_BASE}/sessions`);
      if (res.ok) setSessions(await res.json());
    } catch {
      // Reze not running
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { sessions, loading, refresh };
}

// --- Session Detail (SSE) ---

export function useSessionEvents(namespace: string, sessionId: string) {
  const [snapshot, setSnapshot] = useState<RezeSessionSnapshot | null>(null);
  const [events, setEvents] = useState<CoralEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${REZE_BASE}/session/${encodeURIComponent(namespace)}/${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (e) => {
      try {
        setSnapshot(JSON.parse(e.data));
        setConnected(true);
      } catch {
        // bad data
      }
    });

    es.addEventListener("coral_event", (e) => {
      try {
        const event: CoralEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
      } catch {
        // bad data
      }
    });

    es.addEventListener("ping", () => {
      // keepalive, ignore
    });

    es.addEventListener("error", () => {
      setConnected(false);
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [namespace, sessionId]);

  return { snapshot, events, connected };
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/bambozlor/Desktop/product-lab/reze-claw && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/use-reze.ts vite.config.ts
git commit -m "feat(frontend): add Reze client hook and dev proxy"
```

---

### Task 9: Frontend — Agents Page (Wired)

**Files:**
- Modify: `src/components/dashboard/AgentsPanel.tsx`

- [ ] **Step 1: Rewrite `AgentsPanel.tsx` to fetch from Reze**

Replace mock data with the `useAgents` hook.

```typescript
import { useAgents, type RezeAgent } from "@/shared/use-reze";

function StatusDot({ status }: { status?: string }) {
  const color =
    status === "running" || status === "active"
      ? "bg-emerald-400 animate-pulse"
      : status === "error"
        ? "bg-red-400"
        : "bg-claw-500";
  return <div className={`w-2 h-2 rounded-full ${color}`} />;
}

export function AgentsPanel() {
  const { agents, loading } = useAgents();

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-claw-100 mb-1">Agents</h2>
      <p className="text-sm text-claw-500 mb-6">
        Registered agents in the Coral server
      </p>

      {loading && agents.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">Loading agents...</p>
        </div>
      ) : agents.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">No agents registered. Start Coral server and register agents.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map((agent) => (
            <AgentCard key={agent.name} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent }: { agent: RezeAgent }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-claw-800/50 border border-claw-700/30">
      <div className="flex items-center gap-3">
        <StatusDot status={agent.status} />
        <div>
          <div className="text-sm font-medium text-claw-100">{agent.name}</div>
          {agent.version && (
            <div className="text-xs text-claw-500">{agent.version}</div>
          )}
        </div>
      </div>
      <span className="text-xs text-claw-500 capitalize">
        {agent.status ?? "registered"}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/bambozlor/Desktop/product-lab/reze-claw && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/AgentsPanel.tsx
git commit -m "feat(frontend): wire AgentsPanel to Reze /agents endpoint"
```

---

### Task 10: Frontend — Sessions List Page

**Files:**
- Modify: `src/components/dashboard/SessionsPanel.tsx`

- [ ] **Step 1: Replace stub with full sessions list**

```typescript
import { useNavigate } from "react-router-dom";
import { useSessions, type RezeSession } from "@/shared/use-reze";

function StatusIndicator({ status }: { status?: string }) {
  const config =
    status === "executed" || status === "running"
      ? { color: "bg-emerald-400 animate-pulse", label: "running" }
      : status === "completed"
        ? { color: "bg-claw-400", label: "completed" }
        : status === "failed" || status === "error"
          ? { color: "bg-red-400", label: "failed" }
          : { color: "bg-claw-500", label: status ?? "unknown" };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs text-claw-500 capitalize">{config.label}</span>
    </div>
  );
}

export function SessionsPanel() {
  const { sessions, loading } = useSessions();
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h2 className="text-lg font-medium text-claw-100 mb-1">Sessions</h2>
      <p className="text-sm text-claw-500 mb-6">
        Active and past Coral sessions
      </p>

      {loading && sessions.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">Loading sessions...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-4 rounded-lg bg-claw-800/30 border border-claw-700/20 text-center">
          <p className="text-xs text-claw-500">No sessions. Create one through Reze chat.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map((session) => (
            <button
              key={`${session.namespace}/${session.id}`}
              onClick={() => navigate(`/sessions/${session.namespace}/${session.id}`)}
              className="w-full text-left p-3 rounded-lg bg-claw-800/50 border border-claw-700/30 hover:bg-claw-800 hover:border-claw-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-claw-100 font-mono">
                  {session.id.slice(0, 8)}...
                </span>
                <StatusIndicator status={session.status} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-claw-500">{session.namespace}</span>
                {session.timestamp && (
                  <span className="text-xs text-claw-600">
                    {new Date(session.timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/bambozlor/Desktop/product-lab/reze-claw && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/SessionsPanel.tsx
git commit -m "feat(frontend): add sessions list page with live polling"
```

---

### Task 11: Frontend — Session Detail (Spectator View)

**Files:**
- Modify: `src/components/dashboard/SessionDetailView.tsx`

- [ ] **Step 1: Replace stub with spectator view**

```typescript
import { useParams, useNavigate } from "react-router-dom";
import { useSessionEvents, type CoralEvent } from "@/shared/use-reze";

export function SessionDetailView() {
  const { namespace, sessionId } = useParams<{ namespace: string; sessionId: string }>();
  const navigate = useNavigate();

  if (!namespace || !sessionId) {
    return <div className="p-6 text-claw-500">Invalid session URL</div>;
  }

  return <SessionDetail namespace={namespace} sessionId={sessionId} onBack={() => navigate("/sessions")} />;
}

function SessionDetail({
  namespace,
  sessionId,
  onBack,
}: {
  namespace: string;
  sessionId: string;
  onBack: () => void;
}) {
  const { snapshot, events, connected } = useSessionEvents(namespace, sessionId);

  // Merge snapshot messages + live events into a unified timeline
  const snapshotMessages =
    snapshot?.threads?.flatMap((t) =>
      (t.messages ?? []).map((m) => ({
        kind: "message" as const,
        senderName: m.senderName ?? "unknown",
        text: m.text ?? "",
        timestamp: m.timestamp,
        threadId: m.threadId ?? t.id,
      }))
    ) ?? [];

  const liveItems = events.map((e) => eventToTimelineItem(e));

  const timeline = [
    ...snapshotMessages.map((m) => ({
      ...m,
      key: `snap-${m.timestamp}-${m.senderName}`,
    })),
    ...liveItems.map((item, i) => ({
      ...item,
      key: `live-${i}`,
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-claw-700/50">
        <button
          onClick={onBack}
          className="text-claw-400 hover:text-claw-100 transition-colors text-sm"
        >
          &larr; Back
        </button>
        <div className="flex-1">
          <span className="text-sm font-medium text-claw-100 font-mono">
            {sessionId.slice(0, 8)}...
          </span>
          <span className="text-xs text-claw-500 ml-2">{namespace}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-claw-500"}`}
          />
          <span className="text-[10px] text-claw-500">
            {connected ? "live" : "connecting..."}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {timeline.length === 0 && (
          <div className="text-center text-claw-500 text-sm py-8">
            Waiting for events...
          </div>
        )}

        {timeline.map((item) =>
          item.kind === "message" ? (
            <MessageBubble
              key={item.key}
              sender={item.senderName}
              text={item.text}
              timestamp={item.timestamp}
            />
          ) : (
            <SystemEvent key={item.key} text={item.text} />
          )
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  sender,
  text,
  timestamp,
}: {
  sender: string;
  text: string;
  timestamp?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-accent-light uppercase">
          {sender.slice(0, 2)}
        </span>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-medium text-claw-200">{sender}</span>
          {timestamp && (
            <span className="text-[10px] text-claw-600">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="text-sm text-claw-300 bg-claw-800/50 rounded-lg px-3 py-2 inline-block border border-claw-700/20">
          {text}
        </div>
      </div>
    </div>
  );
}

function SystemEvent({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <span className="text-[10px] text-claw-600 bg-claw-900/50 px-3 py-1 rounded-full">
        {text}
      </span>
    </div>
  );
}

function eventToTimelineItem(event: CoralEvent): {
  kind: "message" | "system";
  senderName: string;
  text: string;
  timestamp?: string;
} {
  if (event.type === "thread_message_sent" && event.message) {
    return {
      kind: "message",
      senderName: event.message.senderName ?? "unknown",
      text: event.message.text ?? "",
      timestamp: event.message.timestamp ?? event.timestamp,
    };
  }

  // All other events → system messages
  const labels: Record<string, string> = {
    runtime_started: `${event.name ?? "agent"} container started`,
    runtime_stopped: `${event.name ?? "agent"} container stopped`,
    agent_connected: `${event.name ?? "agent"} connected to Coral`,
    agent_wait_start: `${event.name ?? "agent"} waiting...`,
    agent_wait_stop: `${event.name ?? "agent"} resumed`,
    thread_created: "thread created",
    thread_closed: "thread closed",
    thread_participant_added: `${event.name ?? "agent"} joined thread`,
    thread_participant_removed: `${event.name ?? "agent"} left thread`,
  };

  return {
    kind: "system",
    senderName: "system",
    text: labels[event.type] ?? event.type,
    timestamp: event.timestamp,
  };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/bambozlor/Desktop/product-lab/reze-claw && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/SessionDetailView.tsx
git commit -m "feat(frontend): add session spectator view with SSE event timeline"
```

---

### Task 12: Frontend — Wire Chat to Reze

**Files:**
- Modify: `src/components/widget/WidgetView.tsx`

- [ ] **Step 1: Update `WidgetView.tsx` to call Reze `/chat`**

```typescript
import { useState } from "react";
import { Titlebar } from "./Titlebar";
import { SceneView } from "./SceneView";
import { ChatInput } from "./ChatInput";

interface WidgetViewProps {
  onExpand: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function WidgetView({ onExpand }: WidgetViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSend = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const res = await fetch("/reze/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "[Error: Reze not reachable]" },
        ]);
        return;
      }

      // Read SSE response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE lines
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data:")) {
              try {
                const parsed = JSON.parse(line.slice(5).trim());
                if (parsed.type === "text") {
                  assistantContent += parsed.content;
                }
              } catch {
                // partial data
              }
            }
          }
        }
      }

      if (assistantContent) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantContent },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "[Error: Failed to reach Reze]" },
      ]);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Titlebar onExpand={onExpand} />
      <div className="flex-1 relative bg-claw-950 overflow-hidden">
        {messages.length === 0 ? (
          <SceneView />
        ) : (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-xs px-3 py-2 rounded-lg max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-accent/20 text-claw-100 ml-auto"
                    : "bg-claw-800 text-claw-300"
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/bambozlor/Desktop/product-lab/reze-claw && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/widget/WidgetView.tsx
git commit -m "feat(frontend): wire widget chat to Reze /chat endpoint"
```

---

### Task 13: Frontend — Coral Status in Sidebar

**Files:**
- Modify: `src/components/dashboard/Sidebar.tsx`

- [ ] **Step 1: Update Sidebar status footer to use Reze health check**

In `Sidebar.tsx`, import and use `useRezeHealth`:

Add at the top:
```typescript
import { useRezeHealth } from "@/shared/use-reze";
```

Inside the `Sidebar` component, add:
```typescript
const health = useRezeHealth();
const coralStatus = health?.coral ?? "disconnected";
const rezeStatus = health ? "connected" : "disconnected";
```

Replace the status footer JSX:
```typescript
{/* Status footer */}
<div className="px-3 py-3 border-t border-claw-700/50 space-y-1">
  <div className="flex items-center gap-1.5">
    <div className={`w-1.5 h-1.5 rounded-full ${rezeStatus === "connected" ? "bg-emerald-400" : "bg-claw-500"}`} />
    <span className="text-[10px] text-claw-500">Reze: {rezeStatus}</span>
  </div>
  <div className="flex items-center gap-1.5">
    <div className={`w-1.5 h-1.5 rounded-full ${coralStatus === "connected" ? "bg-emerald-400" : "bg-claw-500"}`} />
    <span className="text-[10px] text-claw-500">Coral: {coralStatus}</span>
  </div>
</div>
```

- [ ] **Step 2: Verify it compiles**

Run: `cd /Users/bambozlor/Desktop/product-lab/reze-claw && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/Sidebar.tsx
git commit -m "feat(frontend): show live Reze + Coral status in sidebar"
```

---

### Task 14: Phase 1 Integration Test — Ping-Pong

**Files:** None created — this is a manual integration test.

**Prerequisites:**
- Docker running
- Coral server container available
- Alpha and Bravo Docker images built (Tasks 5, 6)
- Reze running (Task 4)
- Frontend dev server running

- [ ] **Step 1: Register agents with Coral**

Copy `coral-agent.toml` files to wherever Coral's agent registry directory is. For the compliance-demo Coral, agents are discovered from local paths. You may need to add the agent directories to Coral's config or filesystem.

Verify agents appear in Coral console at `http://localhost:5555/ui/console/server/registry`.

- [ ] **Step 2: Start Coral server**

Run from the compliance-demo directory:
```bash
cd /Users/bambozlor/Desktop/content-lab/compliance-demo/coral-server && CONFIG_FILE_PATH=./config.toml ./gradlew run
```

Verify: `http://localhost:5555/ui/console/server/registry` shows the agents.

- [ ] **Step 3: Start Reze**

```bash
cd /Users/bambozlor/Desktop/product-lab/reze-claw/agents/reze && npx tsx src/index.ts
```

Verify: `curl http://localhost:3001/health` returns `{"status":"ok","coral":"connected"}`

- [ ] **Step 4: Start frontend**

```bash
cd /Users/bambozlor/Desktop/product-lab/reze-claw && pnpm dev
```

Verify: `http://localhost:5173` loads. Dashboard sidebar shows "Reze: connected" and "Coral: connected".

- [ ] **Step 5: Create a ping-pong session via curl**

```bash
curl -X POST http://localhost:3001/session \
  -H "Content-Type: application/json" \
  -d '{"task": "ping-pong test", "agents": [{"name": "alpha"}, {"name": "bravo"}]}'
```

Expected: JSON response with `sessionId` and `namespace`.

- [ ] **Step 6: Observe in frontend**

Navigate to Sessions tab in dashboard. The session should appear in the list. Click into it. The spectator view should show:

1. System events: runtime_started, agent_connected for both agents
2. System event: thread created
3. Message bubble: alpha → "ping"
4. Message bubble: bravo → "pong"
5. System events: runtime_stopped for both agents

- [ ] **Step 7: Observe via SSE directly**

```bash
curl -N http://localhost:3001/session/rezeclaw/<sessionId>
```

Should stream SSE events matching the timeline above.

- [ ] **Step 8: Verify session cleanup**

After the ping-pong completes, verify:
- Both Docker containers exited (`docker ps -a | grep rezeclaw`)
- Session shows as completed in the frontend

- [ ] **Step 9: Document any issues and fixes**

If anything fails, debug and fix before proceeding to Phase 2. Common issues:
- Agent can't reach Coral: check `host.docker.internal` resolves inside container
- MCP handshake fails: check `@modelcontextprotocol/sdk` version compatibility
- WebSocket events not arriving: check auth token matches Coral config
- CORS issues: verify Reze cors middleware is active

---

## Phase 2: Chain with Image Generation

### Task 15: Charlie Agent

**Files:**
- Create: `agents/charlie/package.json`
- Create: `agents/charlie/tsconfig.json`
- Create: `agents/charlie/coral-agent.toml`
- Create: `agents/charlie/Dockerfile`
- Create: `agents/charlie/src/mcp.ts`
- Create: `agents/charlie/src/index.ts`

- [ ] **Step 1: Create `agents/charlie/package.json`**

```json
{
  "name": "@rezeclaw/agent-charlie",
  "version": "0.1.0",
  "private": true,
  "description": "Charlie — reporter test agent",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create `agents/charlie/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `agents/charlie/coral-agent.toml`**

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

- [ ] **Step 4: Create `agents/charlie/Dockerfile`**

```dockerfile
FROM node:22-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build
CMD ["node", "dist/index.js"]
```

- [ ] **Step 5: Create `agents/charlie/src/mcp.ts`**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function connectMcp(agentName: string): Promise<Client> {
  const connectionUrl = process.env.CORAL_CONNECTION_URL;
  if (!connectionUrl) {
    throw new Error("CORAL_CONNECTION_URL not set");
  }

  console.log(`[${agentName}] Connecting to Coral MCP at ${connectionUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(connectionUrl));
  const client = new Client(
    { name: agentName, version: "0.1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log(`[${agentName}] MCP connected`);

  return client;
}

export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const result = await client.callTool({ name: toolName, arguments: args });
  if (result.content && Array.isArray(result.content)) {
    const textParts = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text);
    if (textParts.length === 1) {
      try {
        return JSON.parse(textParts[0]);
      } catch {
        return textParts[0];
      }
    }
    return textParts.join("\n");
  }
  return result;
}
```

- [ ] **Step 6: Create `agents/charlie/src/index.ts`**

```typescript
import { connectMcp, callTool } from "./mcp.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "charlie";

async function main() {
  console.log(`[${AGENT_NAME}] Starting reporter agent`);

  const client = await connectMcp(AGENT_NAME);

  // Wait for Kali to mention us with the result
  console.log(`[${AGENT_NAME}] Waiting for mention...`);
  const incoming = await callTool(client, "coral_wait_for_mention", {}) as {
    message?: { senderName: string; text: string; threadId: string };
    status: string;
  };

  if (!incoming.message) {
    console.log(`[${AGENT_NAME}] No message received (status: ${incoming.status})`);
    return;
  }

  console.log(
    `[${AGENT_NAME}] Received from ${incoming.message.senderName}: ${incoming.message.text}`
  );

  // Send confirmation
  console.log(`[${AGENT_NAME}] Sending confirmation...`);
  await callTool(client, "coral_send_message", {
    threadId: incoming.message.threadId,
    content: "image generated",
  });

  console.log(`[${AGENT_NAME}] Done.`);
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal error:`, err);
  process.exit(1);
});
```

- [ ] **Step 7: Install dependencies, verify, and build Docker image**

```bash
cd agents/charlie && pnpm install && npx tsc --noEmit && docker build -t rezeclaw/charlie:latest .
```

- [ ] **Step 8: Commit**

```bash
git add agents/charlie/
git commit -m "feat(charlie): add reporter test agent"
```

---

### Task 16: Kali — MCP Integration

**Files:**
- Create: `agents/kali/src/mcp.ts`
- Create: `agents/kali/coral-agent.toml`
- Modify: `agents/kali/src/index.ts`
- Modify: `agents/kali/package.json`
- Modify: `agents/kali/Dockerfile`

- [ ] **Step 1: Add `@modelcontextprotocol/sdk` to Kali's dependencies**

In `agents/kali/package.json`, add to dependencies:
```json
"@modelcontextprotocol/sdk": "^1.12.0"
```

Run: `cd agents/kali && pnpm install`

- [ ] **Step 2: Create `agents/kali/src/mcp.ts`**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export async function connectMcp(agentName: string): Promise<Client> {
  const connectionUrl = process.env.CORAL_CONNECTION_URL;
  if (!connectionUrl) {
    throw new Error("CORAL_CONNECTION_URL not set");
  }

  console.log(`[${agentName}] Connecting to Coral MCP at ${connectionUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(connectionUrl));
  const client = new Client(
    { name: agentName, version: "0.1.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  console.log(`[${agentName}] MCP connected`);

  return client;
}

export async function callTool(
  client: Client,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const result = await client.callTool({ name: toolName, arguments: args });
  if (result.content && Array.isArray(result.content)) {
    const textParts = result.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text);
    if (textParts.length === 1) {
      try {
        return JSON.parse(textParts[0]);
      } catch {
        return textParts[0];
      }
    }
    return textParts.join("\n");
  }
  return result;
}
```

- [ ] **Step 3: Create `agents/kali/coral-agent.toml`**

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

- [ ] **Step 4: Update `agents/kali/src/index.ts`**

Replace the current entrypoint with a Coral-aware version that falls back to CLI mode.

```typescript
import { loadEnv } from "./env.js";
loadEnv();

export { generate } from "./generate.js";
export type { GenerateOptions, AspectRatio, Resolution } from "./generate.js";

async function main() {
  const { generate } = await import("./generate.js");

  // If CORAL_CONNECTION_URL is set, run in Coral agent mode
  if (process.env.CORAL_CONNECTION_URL) {
    const { connectMcp, callTool } = await import("./mcp.js");
    const agentName = process.env.CORAL_AGENT_ID ?? "kali";

    console.log(`[${agentName}] Starting in Coral agent mode`);
    const client = await connectMcp(agentName);

    // Wait for a mention from another agent
    console.log(`[${agentName}] Waiting for mention...`);
    const incoming = await callTool(client, "coral_wait_for_mention", {}) as {
      message?: { senderName: string; text: string; threadId: string };
      status: string;
    };

    if (!incoming.message) {
      console.log(`[${agentName}] No message received (status: ${incoming.status})`);
      return;
    }

    console.log(
      `[${agentName}] Received from ${incoming.message.senderName}: ${incoming.message.text}`
    );

    // Run hardcoded image generation
    console.log(`[${agentName}] Generating image...`);
    const outputUrl = await generate({
      prompt: "a cyberpunk cat with neon eyes in a rain-soaked alley",
      aspectRatio: "1:1",
    });
    console.log(`[${agentName}] Generated: ${outputUrl}`);

    // Send result mentioning charlie
    await callTool(client, "coral_send_message", {
      threadId: incoming.message.threadId,
      content: `done: ${outputUrl}`,
      mentions: ["charlie"],
    });

    console.log(`[${agentName}] Done.`);
    return;
  }

  // CLI fallback mode
  const prompt = process.argv[2];
  if (!prompt) {
    console.log("[Kali] Image generation agent — standing by");
    console.log("[Kali] CLI usage: npx tsx src/index.ts '<prompt>'");
    console.log("[Kali] Set CORAL_CONNECTION_URL to run in Coral agent mode");
    return;
  }

  console.log(`[Kali] Generating: "${prompt}"`);
  const url = await generate(prompt);
  console.log(`[Kali] Output: ${url}`);
}

main().catch(console.error);
```

- [ ] **Step 5: Update `agents/kali/Dockerfile`**

Add a build step since we now have TypeScript compilation:

```dockerfile
FROM node:22-slim
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build
CMD ["node", "dist/index.js"]
```

Note: Kali needs a `tsconfig.json` if it doesn't have one. Create one matching the same pattern as alpha/bravo if missing.

- [ ] **Step 6: Verify compilation**

Run: `cd agents/kali && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Build Docker image**

Run: `cd agents/kali && docker build -t rezeclaw/kali:latest .`

- [ ] **Step 8: Commit**

```bash
git add agents/kali/
git commit -m "feat(kali): add Coral MCP integration for multi-agent sessions"
```

---

### Task 17: Update Alpha for Phase 2 Chain

**Files:**
- Modify: `agents/alpha/src/index.ts`

- [ ] **Step 1: Update Alpha to support the 4-agent chain**

Alpha needs to create a thread with all four agents and send the opening message to bravo.

```typescript
import { connectMcp, callTool } from "./mcp.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "alpha";

async function main() {
  console.log(`[${AGENT_NAME}] Starting initiator agent`);

  const client = await connectMcp(AGENT_NAME);

  // Step 1: Create a thread
  console.log(`[${AGENT_NAME}] Creating thread...`);
  const threadResult = await callTool(client, "coral_create_thread", {}) as {
    threadId: string;
    status: string;
  };
  const threadId = threadResult.threadId;
  console.log(`[${AGENT_NAME}] Thread created: ${threadId}`);

  // Step 2: Add all agents to the thread
  const peers = ["bravo", "kali", "charlie"];
  for (const peer of peers) {
    console.log(`[${AGENT_NAME}] Adding ${peer} to thread...`);
    await callTool(client, "coral_add_participant", {
      threadId,
      agentName: peer,
    });
  }

  // Step 3: Send opening message mentioning bravo
  console.log(`[${AGENT_NAME}] Sending generate request...`);
  await callTool(client, "coral_send_message", {
    threadId,
    content: "generate",
    mentions: ["bravo"],
  });

  // Step 4: Wait for charlie's final confirmation
  console.log(`[${AGENT_NAME}] Waiting for final response...`);
  const response = await callTool(client, "coral_wait_for_message", {}) as {
    message?: { senderName: string; text: string };
    status: string;
  };

  if (response.message) {
    console.log(
      `[${AGENT_NAME}] Received from ${response.message.senderName}: ${response.message.text}`
    );
  } else {
    console.log(`[${AGENT_NAME}] No response received (status: ${response.status})`);
  }

  // Step 5: Close the session
  console.log(`[${AGENT_NAME}] Closing session...`);
  await callTool(client, "coral_close_session", {});
  console.log(`[${AGENT_NAME}] Done.`);
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal error:`, err);
  process.exit(1);
});
```

- [ ] **Step 2: Update Bravo for relay role**

In `agents/bravo/src/index.ts`, update to forward to kali:

```typescript
import { connectMcp, callTool } from "./mcp.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "bravo";

async function main() {
  console.log(`[${AGENT_NAME}] Starting relay agent`);

  const client = await connectMcp(AGENT_NAME);

  // Wait for alpha to mention us
  console.log(`[${AGENT_NAME}] Waiting for mention...`);
  const incoming = await callTool(client, "coral_wait_for_mention", {}) as {
    message?: { senderName: string; text: string; threadId: string };
    status: string;
  };

  if (!incoming.message) {
    console.log(`[${AGENT_NAME}] No message received (status: ${incoming.status})`);
    return;
  }

  console.log(
    `[${AGENT_NAME}] Received from ${incoming.message.senderName}: ${incoming.message.text}`
  );

  // Relay to kali
  console.log(`[${AGENT_NAME}] Relaying to kali...`);
  await callTool(client, "coral_send_message", {
    threadId: incoming.message.threadId,
    content: "generate",
    mentions: ["kali"],
  });

  console.log(`[${AGENT_NAME}] Done.`);
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] Fatal error:`, err);
  process.exit(1);
});
```

- [ ] **Step 3: Rebuild Docker images**

```bash
cd agents/alpha && docker build -t rezeclaw/alpha:latest .
cd ../bravo && docker build -t rezeclaw/bravo:latest .
```

- [ ] **Step 4: Commit**

```bash
git add agents/alpha/src/index.ts agents/bravo/src/index.ts
git commit -m "feat(alpha,bravo): update for phase 2 chain pattern"
```

---

### Task 18: Phase 2 Integration Test — Chain with Image Gen

**Files:** None — manual integration test.

- [ ] **Step 1: Register all four agents with Coral**

Ensure `coral-agent.toml` files for alpha, bravo, kali, charlie are discoverable by Coral's agent registry.

- [ ] **Step 2: Start Coral, Reze, and frontend**

Same as Phase 1 (Task 14, Steps 2-4).

- [ ] **Step 3: Create a chain session via curl**

```bash
curl -X POST http://localhost:3001/session \
  -H "Content-Type: application/json" \
  -d '{
    "task": "chain image gen test",
    "agents": [
      {"name": "alpha"},
      {"name": "bravo"},
      {"name": "kali", "options": {"REPLICATE_API_TOKEN": "<your-token>"}},
      {"name": "charlie"}
    ]
  }'
```

- [ ] **Step 4: Observe in frontend spectator view**

Expected timeline:
1. System: all four containers started
2. System: all four agents connected
3. System: thread created
4. System: bravo, kali, charlie joined thread
5. Message: alpha → "generate" @bravo
6. Message: bravo → "generate" @kali
7. (pause while Kali generates image via Replicate)
8. Message: kali → "done: https://replicate.delivery/..." @charlie
9. Message: charlie → "image generated"
10. System: containers stopped

- [ ] **Step 5: Verify image was actually generated**

Check Kali's container logs:
```bash
docker logs <kali-container-id>
```

Should show the Replicate API call and output URL.

- [ ] **Step 6: Verify session cleanup**

All four containers exited. Session marked complete.

- [ ] **Step 7: Commit any fixes**

If any adjustments were needed, commit them with a descriptive message.

---

## Notes

- **Agent registry endpoint:** The plan assumes agent info can be extracted from session snapshots via Reze's `/agents` proxy. If Coral exposes a dedicated registry REST endpoint (the console UI has one), update `agents/reze/src/routes/agents.ts` to use it directly.
- **MCP SDK compatibility:** The `@modelcontextprotocol/sdk` package must support `StreamableHTTPClientTransport`. If the import path differs in the installed version, check `node_modules/@modelcontextprotocol/sdk/dist/` for the actual export.
- **Docker networking:** Inside containers, Coral is at `host.docker.internal:5555`. On Linux hosts, this may require `--add-host=host.docker.internal:host-gateway` in Docker run config or Coral's DockerRuntime settings.
- **Kali's Replicate token:** Must be passed as an agent option when creating the session so Coral injects it as an env var into the container.
