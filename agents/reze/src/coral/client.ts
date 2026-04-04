import type {
  CreateSessionRequest,
  CreateSessionResponse,
  NamespaceState,
  SessionSnapshot,
  RegistrySource,
} from "@rezeclaw/coral-types/api";

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

  /** List agents from the Coral registry */
  async listRegistryAgents(): Promise<{ name: string; version: string; summary?: string }[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/registry`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Coral registry fetch failed: ${res.status}`);
    const sources: RegistrySource[] = await res.json();

    const agents: { name: string; version: string; summary?: string }[] = [];
    for (const source of sources) {
      for (const agent of source.agents) {
        const version = agent.versions[0] ?? "0.0.0";
        agents.push({ name: agent.name, version });
      }
    }
    return agents;
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
