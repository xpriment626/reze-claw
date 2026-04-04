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
