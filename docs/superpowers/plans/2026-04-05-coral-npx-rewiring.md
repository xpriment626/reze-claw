# Coral NPX Rewiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the local coral-server clone with `npx coral-server@1.1.0`, register alpha/bravo/kali as Coral agents via config-based discovery, wire Kali to Coral MCP, and keep Reze excluded from Coral agent discovery.

**Architecture:** Coral server runs via npx as a native process on port 5555. A `coral.config.toml` in the project root points at `agents/*` for agent discovery — any directory with a `coral-agent.toml` is registered, directories without one (reze) are skipped. Kali gets MCP wiring following the existing alpha/bravo pattern. dev.sh orchestrates startup: Coral → Reze → Tauri.

**Tech Stack:** npx coral-server@1.1.0, TOML config, @modelcontextprotocol/sdk, TypeScript, pnpm workspace

---

### Task 1: Coral Server Config

**Files:**
- Create: `coral.config.toml`

- [ ] **Step 1: Create coral.config.toml in project root**

```toml
[auth]
keys = ["ligma"]

[network]
allowAnyHost = true

[registry]
localAgents = ["agents/*"]
watchLocalAgents = true
```

This config:
- `auth.keys` — bearer token for API access (matches existing convention)
- `allowAnyHost` — allows frontend dev server connections
- `localAgents = ["agents/*"]` — scans each directory under `agents/` for a `coral-agent.toml`. Directories without one (reze) are silently skipped.
- `watchLocalAgents` — hot-reloads when toml files change during dev

- [ ] **Step 2: Verify npx coral-server is available**

Run: `npx coral-server@1.1.0 --help 2>&1 | head -20`

Expected: Help output or version info confirming the package exists on npm. If this fails with "not found", fall back to `npx @anthropic-ai/coral-server@1.1.0` or check the exact package name on npm.

- [ ] **Step 3: Commit**

```bash
git add coral.config.toml
git commit -m "feat: add coral.config.toml for npx-based Coral server"
```

---

### Task 2: Agent Registration — Alpha & Bravo

**Files:**
- Create: `agents/alpha/coral-agent.toml`
- Create: `agents/bravo/coral-agent.toml`

- [ ] **Step 1: Create agents/alpha/coral-agent.toml**

```toml
edition = 3

[agent]
name = "alpha"
version = "0.1.0"
summary = "Initiator agent that creates threads and sends the opening message"
description = "Test agent that kicks off a Coral session by creating a thread, adding participants, and sending the first message."
readme = "Alpha is a deterministic test agent for validating Coral message-passing pipelines."

[agent.license]
type = "text"
text = "MIT"

[options]

[runtimes.executable]
path = "npx"
arguments = ["tsx", "src/index.ts"]
transport = "streamable_http"

[runtimes.docker]
image = "rezeclaw/alpha"
transport = "streamable_http"
```

- [ ] **Step 2: Create agents/bravo/coral-agent.toml**

```toml
edition = 3

[agent]
name = "bravo"
version = "0.1.0"
summary = "Responder agent that echoes messages back"
description = "Test agent that waits for a mention and responds with a pong message on the same thread."
readme = "Bravo is a deterministic test agent for validating Coral message-passing pipelines."

[agent.license]
type = "text"
text = "MIT"

[options]

[runtimes.executable]
path = "npx"
arguments = ["tsx", "src/index.ts"]
transport = "streamable_http"

[runtimes.docker]
image = "rezeclaw/bravo"
transport = "streamable_http"
```

- [ ] **Step 3: Commit**

```bash
git add agents/alpha/coral-agent.toml agents/bravo/coral-agent.toml
git commit -m "feat: recreate coral-agent.toml for alpha and bravo (v1.1 edition 3)"
```

---

### Task 3: Agent Registration — Kali

**Files:**
- Create: `agents/kali/coral-agent.toml`

- [ ] **Step 1: Create agents/kali/coral-agent.toml**

```toml
edition = 3

[agent]
name = "kali"
version = "0.1.0"
summary = "Image generation agent powered by Replicate"
description = "Generates images from text prompts using Flux models via the Replicate API. Accepts a prompt, returns an image URL."
readme = "Kali wraps the Replicate API for image generation. Supports Flux 2 Pro/Dev models with configurable aspect ratios and resolutions."

[agent.license]
type = "text"
text = "MIT"

[options.REPLICATE_API_TOKEN]
type = "string"
required = true
secret = true
display.description = "Replicate API token for image generation"

[runtimes.executable]
path = "npx"
arguments = ["tsx", "src/index.ts"]
transport = "streamable_http"

[runtimes.docker]
image = "rezeclaw/kali"
transport = "streamable_http"
```

Key difference from alpha/bravo: Kali declares `REPLICATE_API_TOKEN` as a required secret option. Coral provides this as an environment variable when launching the agent — no `.env` file loading needed during orchestration.

- [ ] **Step 2: Commit**

```bash
git add agents/kali/coral-agent.toml
git commit -m "feat: add coral-agent.toml for kali with REPLICATE_API_TOKEN option"
```

---

### Task 4: Wire Kali to Coral MCP

**Files:**
- Modify: `agents/kali/package.json`
- Create: `agents/kali/src/mcp.ts`
- Modify: `agents/kali/src/index.ts`

- [ ] **Step 1: Add MCP SDK and coral-types dependencies to kali package.json**

Add to `dependencies` in `agents/kali/package.json`:

```json
{
  "dependencies": {
    "replicate": "^1.0.0",
    "@rezeclaw/coral-types": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.0"
  }
}
```

- [ ] **Step 2: Create agents/kali/src/mcp.ts**

This is the same MCP connection helper used by alpha and bravo:

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

- [ ] **Step 3: Rewrite agents/kali/src/index.ts for dual-mode operation**

Replace the entire file. Coral mode connects via MCP, waits for a mention, generates the image, and sends back the URL. Standalone mode loads `.env` and runs from CLI args as before.

```typescript
import type { WaitForMessageOutput, SendMessageOutput } from "@rezeclaw/coral-types/tools";
import { generate } from "./generate.js";

const AGENT_NAME = process.env.CORAL_AGENT_ID ?? "kali";

/**
 * Coral mode — launched by Coral server with CORAL_CONNECTION_URL set.
 * REPLICATE_API_TOKEN is provided by Coral as an agent option (env var).
 * Do NOT load .env files during orchestration.
 */
async function coralMode() {
  const { connectMcp, callTool } = await import("./mcp.js");

  console.log(`[${AGENT_NAME}] Starting in Coral mode`);
  const client = await connectMcp(AGENT_NAME);

  // Wait for someone to mention us with a prompt
  console.log(`[${AGENT_NAME}] Waiting for mention...`);
  const { message } = (await callTool(
    client,
    "coral_wait_for_mention",
    {}
  )) as WaitForMessageOutput;

  if (!message) {
    console.log(`[${AGENT_NAME}] No message received`);
    return;
  }

  console.log(`[${AGENT_NAME}] Received from ${message.senderName}: ${message.text}`);

  // Generate the image
  console.log(`[${AGENT_NAME}] Generating image...`);
  const url = await generate(message.text);
  console.log(`[${AGENT_NAME}] Generated: ${url}`);

  // Send the result back on the same thread
  (await callTool(client, "coral_send_message", {
    threadId: message.threadId,
    content: url,
    mentions: [message.senderName],
  })) as SendMessageOutput;

  console.log(`[${AGENT_NAME}] Done.`);
}

/**
 * Standalone mode — no Coral server, runs from CLI args.
 * Loads .env for REPLICATE_API_TOKEN.
 */
async function standaloneMode() {
  const { loadEnv } = await import("./env.js");
  loadEnv();

  const prompt = process.argv[2];
  if (!prompt) {
    console.log("[Kali] Image generation agent — standing by");
    console.log("[Kali] CLI usage: npx tsx src/index.ts '<prompt>'");
    return;
  }

  console.log(`[Kali] Generating: "${prompt}"`);
  const url = await generate(prompt);
  console.log(`[Kali] Output: ${url}`);
}

// Route to the appropriate mode
const isCoralMode = !!process.env.CORAL_CONNECTION_URL;

if (isCoralMode) {
  coralMode().catch((err) => {
    console.error(`[${AGENT_NAME}] Fatal error:`, err);
    process.exit(1);
  });
} else {
  standaloneMode().catch(console.error);
}
```

Key design decisions:
- Dynamic `import("./mcp.js")` in coral mode — avoids loading MCP SDK when running standalone
- `loadEnv()` only called in standalone mode — follows Coral's "do not load .env during orchestration" guidance
- `REPLICATE_API_TOKEN` comes from Coral option env var in coral mode, from `.env` in standalone mode
- Single-shot execution: wait for mention → generate → respond → exit (matches session-per-task model)

- [ ] **Step 4: Run pnpm install to update lockfile**

Run: `pnpm install`

Expected: lockfile updates with @modelcontextprotocol/sdk and @rezeclaw/coral-types added to kali's dependency tree. No errors.

- [ ] **Step 5: Commit**

```bash
git add agents/kali/package.json agents/kali/src/mcp.ts agents/kali/src/index.ts pnpm-lock.yaml
git commit -m "feat: wire kali to Coral MCP with dual-mode (coral + standalone)"
```

---

### Task 5: Update dev.sh with Coral Server Startup

**Files:**
- Modify: `scripts/dev.sh`

- [ ] **Step 1: Rewrite scripts/dev.sh to start Coral via npx before Reze**

Replace the entire file:

```bash
#!/usr/bin/env bash
set -euo pipefail

# RezeClaw — unified dev launcher
# Starts Coral server, Reze gateway, and Tauri frontend with health-check gating.
# Ctrl+C kills all three cleanly.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REZE_DIR="$ROOT_DIR/agents/reze"

CORAL_PORT=5555
REZE_PORT=3001
CORAL_AUTH_TOKEN="${CORAL_AUTH_TOKEN:-ligma}"

# Track child PIDs for cleanup
PIDS=()

cleanup() {
  echo ""
  echo "[dev] Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  echo "[dev] Done."
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

wait_for_port() {
  local port=$1
  local name=$2
  local max_wait=${3:-60}
  local elapsed=0

  while ! curl -s -o /dev/null -w "" "http://127.0.0.1:$port" 2>/dev/null; do
    if [ $elapsed -ge $max_wait ]; then
      echo "[dev] ERROR: $name did not start within ${max_wait}s"
      exit 1
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done
  echo "[dev] $name is up (port $port, ${elapsed}s)"
}

# --- 1. Coral Server (via npx) ---
echo "[dev] Starting Coral server via npx..."
cd "$ROOT_DIR"
CONFIG_FILE_PATH=./coral.config.toml npx coral-server@1.1.0 start &>/tmp/coral-server-dev.log &
PIDS+=($!)
wait_for_port $CORAL_PORT "Coral" 120

# --- 2. Reze Gateway ---
echo "[dev] Starting Reze gateway..."
cd "$REZE_DIR"
CORAL_API_URL="http://localhost:$CORAL_PORT" \
CORAL_AUTH_TOKEN="$CORAL_AUTH_TOKEN" \
npx tsx src/index.ts &>/tmp/reze-dev.log &
PIDS+=($!)
wait_for_port $REZE_PORT "Reze" 15

# --- 3. Tauri Frontend ---
echo "[dev] Starting Tauri frontend..."
cd "$ROOT_DIR"
pnpm tauri dev 2>&1 &
PIDS+=($!)

echo ""
echo "[dev] All services running:"
echo "  Coral:    http://localhost:$CORAL_PORT/ui/console"
echo "  Reze:     http://localhost:$REZE_PORT/health"
echo "  Frontend: Tauri desktop app"
echo ""
echo "  Logs: /tmp/coral-server-dev.log, /tmp/reze-dev.log"
echo "  Press Ctrl+C to stop all"
echo ""

# Wait for any child to exit
wait
```

Changes from the cleaned-up version:
- Adds Coral server startup block back, using `npx coral-server@1.1.0 start` instead of `./gradlew run`
- `cd "$ROOT_DIR"` before starting Coral so `localAgents = ["agents/*"]` resolves correctly
- `CONFIG_FILE_PATH=./coral.config.toml` points at the new config
- 120s timeout for first-run npx download
- Passes `CORAL_API_URL` and `CORAL_AUTH_TOKEN` explicitly to Reze
- Console URL back in the startup banner

- [ ] **Step 2: Commit**

```bash
git add scripts/dev.sh
git commit -m "feat: dev.sh starts Coral via npx coral-server@1.1.0"
```

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add Coral server section and Reze exclusion note to CLAUDE.md**

Add after the "Dev workflow" section:

```markdown
# Coral server

- Runs via npx: `CONFIG_FILE_PATH=./coral.config.toml npx coral-server@1.1.0 start`
- Config: `coral.config.toml` in project root (auth, registry globs)
- Agent discovery: `localAgents = ["agents/*"]` — scans for `coral-agent.toml` in each subdir
- Reze is in `agents/` for workspace convenience but is NOT a Coral agent — no `coral-agent.toml` by design
- Console UI: `http://localhost:5555/ui/console` (auth token: `ligma`)
- Agent options (like API keys) are provided at session creation time and passed as env vars
```

Also update the project structure tree to reflect the config file:

```
reze-claw/
  coral.config.toml         # Coral server config (auth, agent discovery)
  packages/coral-types/      # @rezeclaw/coral-types — shared type definitions
  agents/
    reze/                    # Gateway agent (Hono HTTP, port 3001) — NOT a Coral agent
    alpha/                   # Test initiator agent (ping-pong)
    bravo/                   # Test responder agent (ping-pong)
    kali/                    # Image generation agent (Replicate)
  src/                       # React 19 frontend (Tauri webview)
  src-tauri/                 # Tauri native shell
  scripts/dev.sh             # Unified launcher: Coral → Reze → Tauri
```

And update the dev workflow line:

```markdown
- `pnpm dev:all` starts everything (Coral server, Reze gateway, Tauri app)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with npx Coral setup and Reze exclusion note"
```

---

### Task 7: Smoke Test

This task verifies the full stack works end-to-end.

- [ ] **Step 1: Start Coral server standalone and verify agent discovery**

Run from project root:

```bash
CONFIG_FILE_PATH=./coral.config.toml npx coral-server@1.1.0 start &
sleep 10
curl -s -H "Authorization: Bearer ligma" http://localhost:5555/api/v1/registry | jq .
```

Expected: JSON response listing alpha, bravo, and kali as registered agents. Reze should NOT appear.

If `npx coral-server@1.1.0` fails (package not found on npm), check:
1. `npx @coral-protocol/coral-server@1.1.0 start` (scoped package name)
2. `npx coral-server start` (latest without version pin)
3. If neither works, the npm package may not be published yet — fall back to the gradle approach as documented in the quickstart and update the plan.

- [ ] **Step 2: Verify Reze can connect to Coral**

In a separate terminal:

```bash
cd agents/reze
CORAL_API_URL=http://localhost:5555 CORAL_AUTH_TOKEN=ligma npx tsx src/index.ts &
sleep 3
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/agents | jq .
```

Expected:
- `/health` returns `{ "status": "ok", "coral": "connected" }`
- `/agents` returns array containing alpha, bravo, kali (not reze)

- [ ] **Step 3: Clean up test processes**

```bash
pkill -f "coral-server" || true
pkill -f "tsx.*reze" || true
```

- [ ] **Step 4: Test full dev.sh startup**

```bash
pnpm dev:all
```

Expected: All three services start (Coral, Reze, Tauri). Check:
- `http://localhost:5555/ui/console` — Coral console loads
- `http://localhost:3001/health` — Reports coral connected
- `http://localhost:3001/agents` — Lists alpha, bravo, kali

Then Ctrl+C to stop all.

- [ ] **Step 5: Commit any fixes from smoke testing**

If any adjustments were needed (package name, config paths, etc.), commit them:

```bash
git add -A
git commit -m "fix: adjustments from smoke testing npx Coral setup"
```
