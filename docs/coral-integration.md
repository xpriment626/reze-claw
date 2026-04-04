# Coral Server Integration — Corrected Model

> Supersedes the incorrect assumptions in `coral-server/CONTEXT.md`.
> Written 2026-04-02.

---

## The Error in CONTEXT.md

The original context doc described Coral as a pure MCP endpoint where agents self-connect by hitting `http://localhost:5555/mcp?agentId=<name>` with the config.toml auth key. **This is wrong.**

Coral is a platform that manages agent lifecycle. The config key and agent secrets are separate auth systems, agents must be registered in a session before they can connect, and the server itself orchestrates agent launch.

---

## How Coral Actually Works

### Two Auth Systems

| Auth Scope | Mechanism | Used By |
|------------|-----------|---------|
| API / Console | Bearer token matching `config.toml` `[auth].keys` | Session creators (console UI, gateway agent, API clients) |
| Agent MCP connection | Per-agent UUID secret issued at session creation | Agents connecting to their MCP endpoint |

The config key is **not** what agents authenticate with. Each agent receives a unique secret (UUID) when its session is created.

### Agent Lifecycle

```
1. API Client (config key) → POST /api/v1/local/session
   └─ Defines an AgentGraph: which agents, what runtime, what instructions

2. Server creates session → issues UUID secret per agent

3. Server launches agents via runtime:
   ├─ ExecutableRuntime: forks a local process
   └─ DockerRuntime: runs a Docker container
   
   Either way, the server passes env vars:
     CORAL_CONNECTION_URL = http://localhost:5555/mcp/{secret}/sse
     CORAL_AGENT_ID       = <agent-name>
     CORAL_AGENT_SECRET   = <uuid>
     CORAL_SESSION_ID     = <session-id>
     CORAL_RUNTIME_ID     = executable | docker

4. Agent process starts → uses CORAL_AGENT_SECRET to connect to MCP

5. Agents communicate:
   - coral_send_message  → send to other agents in the session
   - coral_wait_for_mention → block until @-mentioned
   - coral://instruction → read agent-specific instructions
   - coral://state → read conversation state

6. Session ends → secrets revoked, agents torn down
```

### Key Implications for RezeClaw

1. **Coral IS the container orchestrator** — the gateway agent doesn't spawn agent containers directly. It calls the Coral session API to define the agent graph, and Coral handles the Docker lifecycle.

2. **The gateway agent needs the config key** — it acts as the API client that creates sessions. Sub-agents never see the config key; they only get their issued secrets.

3. **Agent images must be pre-built** — since Coral pulls and runs Docker images via DockerRuntime, our agent images need to be available (local registry or remote).

4. **Docker socket sharing is required** — when Coral runs in Docker and uses DockerRuntime, it needs the host's Docker socket mounted (`-v /var/run/docker.sock:/var/run/docker.sock`).

5. **The "lead agent" pattern maps to session creator** — the gateway agent creates Coral sessions, making it the natural coordinator without needing a special role in the Coral topology.

---

## Source References (coral-server repo)

| Concern | File | Key Lines |
|---------|------|-----------|
| Agent secret issuance | `LocalSessionManager.kt` | 102–115 |
| Secret assigned to agent | `SessionAgent.kt` | 84 |
| Secret passed as env var | `SessionAgentExecutionContext.kt` | 123 |
| MCP auth check | `McpRoutes.kt` | 56–75 |
| Auth scheme definitions | `CoralServerModule.kt` | 195–219 |
| Route auth separation | `CoralServerModule.kt` | 227–235 |
| Session API | `SessionApi.kt` | 56–126 |
| Agent launch orchestration | `SessionAgent.kt` | 477–479 |
