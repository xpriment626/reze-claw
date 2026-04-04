# Coral Server Deployment — Executable vs Docker

> Written 2026-04-02. Based on source analysis of coral-server repo.

---

## Build System

- **Kotlin 2.3.20**, **JDK 24**, Gradle build
- Produces a **fat JAR** (uber-jar) with all dependencies bundled
- Dockerfile uses a **multi-stage build**: `gradle:9.0.0-jdk24-noble` to build, then `jlink` to create a minimal JRE (~150-250MB vs ~400-600MB for full JDK), final image is `ubuntu:noble` + the custom JRE + the JAR
- Entrypoint: `java -jar /app/coral-server.jar`

---

## Networking

- **Ktor CIO engine** (async, coroutine-based)
- Binds `0.0.0.0:5555` by default (configurable via `config.toml` `[network]` section)
- **No TLS** — the server is plain HTTP only. `cookie.secure = true` is commented out in source.
- **No health endpoint** — no `/health` or `/ready` route. Closest proxy: `GET /api_v1.json` (OpenAPI spec) returns 200 if running.
- Graceful shutdown via JVM `addShutdownHook` (responds to SIGTERM / Ctrl+C)

---

## Agent Runtimes

### ExecutableRuntime
- Forks an OS process directly (`kotlin-process` library)
- Resolves executable path: absolute → relative to agent config → system PATH
- Passes env vars (CORAL_AGENT_SECRET, etc.) to the subprocess
- **Only works on JVM executable deployment** — the Docker image is minimal Ubuntu with no dev tools

### DockerRuntime
- Uses Docker Java client to pull images, create containers, stream logs, cleanup
- Container named after agent secret UUID
- Mounts temporary file volumes from host to container
- Agent callback URL uses `host.docker.internal` (macOS/Windows) or `172.17.0.1` (Linux)
- **Requires Docker socket access** regardless of how Coral itself is deployed
- On cleanup: force-removes container + volumes

---

## Config Loading

Priority order (later overrides earlier):
1. Built-in `/config.toml` from classpath (optional)
2. External file via `CONFIG_FILE_PATH` env var
3. Environment variable overrides (Hoplite env source)

Docker socket resolution:
1. System property `CORAL_DOCKER_SOCKET` or `docker.host` / `docker.socket`
2. Env var `DOCKER_SOCKET`
3. Colima socket `$HOME/.colima/default/docker.sock`
4. Default `unix:///var/run/docker.sock`

---

## Comparison: JVM Executable vs Docker

| Aspect | `./gradlew run` on VPS | Docker container |
|--------|------------------------|------------------|
| **JDK install** | You install JDK 24 | Bundled in image |
| **Memory** | ~400-600MB (full JDK) | ~150-250MB (jlink minimal JRE) |
| **Startup** | ~3-5s (first run slower due to Gradle) | ~2-3s |
| **ExecutableRuntime** | Works (can fork local processes) | Broken (no shell/tools in minimal image) |
| **DockerRuntime** | Works (local Docker daemon) | Works only with `-v /var/run/docker.sock` |
| **TLS** | Need reverse proxy (Caddy/nginx) | Need reverse proxy (Caddy/nginx) |
| **Config file** | Local path via `CONFIG_FILE_PATH` | Must mount into container |
| **Logs** | Stdout + `$HOME/.coral/logs` | `docker logs coral-server` |
| **Updates** | `git pull && ./gradlew run` | `docker pull` new image |
| **Process management** | systemd / supervisor / tmux | Docker restart policy |
| **Port binding** | Direct on 5555 | Map with `-p 5555:5555` |

---

## Cloud Deployment Scenarios

### Option A: VPS + JVM Executable + Caddy

```
VPS (e.g., Hetzner, DigitalOcean)
├── Caddy (reverse proxy, auto-TLS via Let's Encrypt)
│   └── proxy :443 → localhost:5555
├── coral-server (./gradlew run, managed by systemd)
├── Docker daemon (for agent containers via DockerRuntime)
└── PocketBase (separate process or container)
```

**Pros:**
- ExecutableRuntime AND DockerRuntime both work
- Simpler debugging (direct process, no container layers)
- Full system access for agent processes

**Cons:**
- Must install/manage JDK 24 on the VPS
- Process management falls on you (systemd unit file)
- Harder to reproduce environment across machines

### Option B: VPS + Docker Compose

```
VPS
├── Caddy (container or host-level)
│   └── proxy :443 → coral-server:5555
├── coral-server (container, Docker socket mounted)
├── PocketBase (container)
└── Agent containers (spawned by coral-server via DockerRuntime)
```

**Pros:**
- Reproducible: `docker compose up` and done
- Smaller memory footprint (jlink JRE)
- Easy updates (`docker compose pull && docker compose up -d`)
- Everything in one compose file

**Cons:**
- ExecutableRuntime broken (no dev tools in minimal image)
- Docker-in-Docker via socket mount (security concern in prod)
- Extra layer of indirection for debugging

### Option C: Fly.io

```
Fly.io
├── coral-server (Fly Machine, Docker image)
│   └── Problem: no Docker socket available
├── PocketBase (Fly Machine)
└── Agent containers — ???
```

**Problem:** Fly.io runs Firecracker microVMs, not Docker. There is no Docker socket to mount. Coral's DockerRuntime cannot spawn agent containers on Fly.io.

**Workaround options:**
1. Use a remote Docker host (separate VPS running Docker daemon, Coral connects to it via TCP) — adds latency, complexity
2. Custom RemoteRuntime (Coral has a TODO stub for this) that uses Fly Machines API instead of Docker — significant dev work
3. Run everything on a single Fly Machine that has Docker installed — defeats the purpose of Fly's model

---

## Recommendation

Given that Coral's DockerRuntime needs the Docker socket, **Fly.io is a poor fit for this project.** The entire agent-spawning model breaks without Docker.

**Best path: VPS + Docker Compose + Caddy.**

### VPS Spec

Singapore or Tokyo region (optimised for Philippines-based development).

**Provider:** Vultr (Singapore or Tokyo region)
**Target plan:** 2 vCPUs, 2GB memory, 65GB SSD, 3TB bandwidth — **$18/mo with auto backups**.

Resource budget:
- Coral server (jlink JRE): ~200-400MB RAM
- PocketBase: ~10-30MB RAM
- Caddy: ~20-40MB RAM
- Headroom for agents: ~1.5GB (~50-100MB per TS agent, supports 5-10 concurrent)
- 2 vCPUs needed: Coral + active agents will saturate single core during bursts
- 65GB SSD plenty for Docker images (shared base layers across agents)
- 3TB bandwidth sufficient: agent traffic is small JSON, LLM calls go outbound to xAI/OpenAI

The 1 vCPU / 1GB / $6 plan would boot but swap under concurrent agent load. Not viable.

### Why this works

- One-command deployment (`docker compose up`)
- DockerRuntime works via socket mount
- Caddy handles TLS automatically (Let's Encrypt)
- Easy to move between VPS providers
- PocketBase runs alongside as another service in the compose file
- Auto backups protect against accidental volume wipes
