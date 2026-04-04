# General preferences 
- default to Exa MCP for search
- use github CLI to search repos when prompted

# Project structure

```
reze-claw/
  coral-server/            # Coral server (Kotlin/Gradle 8.14, runs natively)
  packages/coral-types/    # @rezeclaw/coral-types — shared type definitions (single source of truth)
  agents/
    reze/                  # Gateway agent (Hono HTTP, port 3001)
    alpha/                 # Test initiator agent (ping-pong)
    bravo/                 # Test responder agent (ping-pong)
    kali/                  # Image generation agent (not yet Coral-wired)
  src/                     # React 19 frontend (Tauri webview)
  src-tauri/               # Tauri native shell
  scripts/dev.sh           # Unified launcher: Coral → Reze → Tauri
```

# Dev workflow

- `pnpm dev:all` starts everything (Coral server, Reze gateway, Tauri app)
- Coral auth token: `ligma` (coral-server/config.toml)
- Agent registration: symlink agent dir into `~/.coral/agents/`, must have valid `coral-agent.toml`
- All Coral/MCP types live in `@rezeclaw/coral-types` — never define inline
- pnpm workspace: `packages/*` and `agents/*`
- Frontend uses MemoryRouter (Tauri) and detects runtime for API base URL
- Vite proxy prefix is `/reze/` (trailing slash — avoids matching `/reze-*.webp` assets)

# Coral server

- Run natively: `cd coral-server && CONFIG_FILE_PATH=./config.toml ./gradlew run`
- Do NOT run in Docker when agents use ExecutableRuntime
- Gradle 8.14 required (9.x breaks foojay plugin)
- Agents discovered from `~/.coral/agents/*/coral-agent.toml`

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