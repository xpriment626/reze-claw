# General preferences 
- default to Exa MCP for search
- use github CLI to search repos when prompted

# Project structure

```
reze-claw/
  coral.config.toml         # Coral server config (auth, agent discovery)
  packages/coral-types/      # @rezeclaw/coral-types — shared type definitions (single source of truth)
  agents/
    reze/                    # Gateway agent (Hono HTTP, port 3001) — NOT a Coral agent
    alpha/                   # Test initiator agent (ping-pong)
    bravo/                   # Test responder agent (ping-pong)
    kali/                    # Image generation agent (Replicate)
  src/                       # React 19 frontend (Tauri webview)
  src-tauri/                 # Tauri native shell
  scripts/dev.sh             # Unified launcher: Coral → Reze → Tauri
```

# Dev workflow

- `pnpm dev:all` starts everything (Coral server, Reze gateway, Tauri app)
- All Coral/MCP types live in `@rezeclaw/coral-types` — never define inline
- pnpm workspace: `packages/*` and `agents/*`
- Frontend uses MemoryRouter (Tauri) and detects runtime for API base URL
- Vite proxy prefix is `/reze/` (trailing slash — avoids matching `/reze-*.webp` assets)

# Coral server

- Runs via npx: `CONFIG_FILE_PATH=./coral.config.toml npx coral-server@1.1.0 start --registry.local-agents="$PWD/agents/*"`
- Config: `coral.config.toml` in project root (auth, network settings)
- Agent discovery: `--registry.local-agents` CLI arg with absolute path (relative paths don't resolve); scans for `coral-agent.toml` in each subdir
- Requires Java 24+ (dev.sh auto-detects via `/usr/libexec/java_home`)
- Reze is in `agents/` for workspace convenience but is NOT a Coral agent — no `coral-agent.toml` by design
- Console UI: `http://localhost:5555/ui/console` (auth token: `ligma`)
- Agent options (like API keys) are provided at session creation time and passed as env vars

# Operating procedure for when in --dangerously-skip-permissions mode

## Uncertainty Handling

If you are unsure whether an action is destructive, irreversible, or outside the scope of the current task — STOP and ask. Do not guess. Do not assume. The cost of asking is zero. The cost of a wrong destructive action is not. You are already given freedom to bypass permissions, this harness asks only that you follow simple rules to avoid unintended destructive outcomes.

## **Filesystem Rules**

- NEVER modify, delete, or move files outside of `pwd`
- NEVER touch ~/.ssh, ~/.gitconfig, ~/.zshrc, ~/.env, or any dotfiles unless explicitly asked
- NEVER write secrets, API keys, or credentials to any file
- Before any recursive delete (rm -rf), list what will be deleted and confirm the path is within the project directory
- NEVER run chmod 777 on anything

## Network Rules

- NEVER expose ports publicly (bind to 127.0.0.1 only)
- NEVER install packages globally (no sudo npm i -g, no pip install without --user or venv)

## **Git Rules**

- NEVER force push (no --force or -f on push)
- NEVER commit .env files, secrets, or credentials
- Always review staged changes before committing

## **Process Rules**

- ALWAYS gracefully shutdown processes that persist after task completion (no nohup, no background daemons left running, etc)
- Clean up any spawned child processes (browsers, servers, watchers) before marking task complete. ALWAYS check for orphaned / zombie processes
- NEVER modify cron, systemd, or launchd configurations
- NEVER modify firewall or iptables rules

## **Destructive Operations**

- Before any DELETE, DROP, TRUNCATE on a database: echo the exact query first, state what it affects, then execute
- Before overwriting any existing file: confirm the file exists and state you are overwriting it
- NEVER run database migrations without explicit instruction
- NEVER prune Docker images/containers/volumes without explicit instruction