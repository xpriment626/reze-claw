// Coral REST API request/response types.
// Matches coral-server routes under /api/v1/.

import type {
  RegistryAgentIdentifier,
  RegistrySourceId,
  RuntimeId,
  UniqueAgentName,
  CoralThread,
  CoralMessage,
  AgentStatus,
} from "./domain.js";

// --- POST /api/v1/local/session ---

export interface CreateSessionRequest {
  agentGraphRequest: {
    agents: AgentGraphEntry[];
    groups: UniqueAgentName[][];
    customTools?: Record<string, unknown>;
  };
  namespaceProvider: NamespaceProvider;
  execution?: SessionExecution;
  annotations?: Record<string, string>;
}

export interface AgentGraphEntry {
  id: RegistryAgentIdentifier;
  name: UniqueAgentName;
  provider: AgentProvider;
  options?: Record<string, AgentOptionValue>;
  systemPrompt?: string;
  blocking?: boolean;
  customToolAccess?: string[];
  plugins?: unknown[];
  x402Budgets?: unknown[];
  annotations?: Record<string, string>;
}

export interface AgentProvider {
  type: "local" | "linked" | "remote" | "remote_request";
  runtime: RuntimeId;
}

export interface AgentOptionValue {
  type: string;
  value: string | number | boolean | string[];
}

export type NamespaceProvider =
  | {
      type: "use_existing";
      name: string;
    }
  | {
      type: "create_if_not_exists";
      namespaceRequest: {
        name: string;
        deleteOnLastSessionExit: boolean;
        annotations?: Record<string, string>;
      };
    };

export interface SessionExecution {
  mode: "immediate" | "defer";
  runtimeSettings?: {
    ttl?: number;
    extendedEndReport?: boolean;
  };
}

export interface CreateSessionResponse {
  sessionId: string;
  namespace: string;
}

// --- GET /api/v1/registry ---

export interface RegistrySource {
  identifier: RegistrySourceId;
  timestamp: string;
  name: string;
  agents: RegistryAgentCatalog[];
}

export interface RegistryAgentCatalog {
  name: string;
  versions: string[];
}

// --- GET /api/v1/local/namespace/extended ---

export interface NamespaceState {
  base?: { name?: string };
  sessions?: NamespaceSession[];
}

export interface NamespaceSession {
  id?: string;
  timestamp?: string;
  status?: { type?: string };
}

// --- GET /api/v1/local/session/{ns}/{id}/extended ---

export interface SessionSnapshot {
  base?: {
    id: string;
    timestamp: string;
    namespace: string;
    status?: { type: string };
  };
  agents?: SessionSnapshotAgent[];
  threads?: CoralThread[];
}

export interface SessionSnapshotAgent {
  name: UniqueAgentName;
  registryAgentIdentifier?: RegistryAgentIdentifier;
  status?: AgentStatus;
  description?: string;
  links?: UniqueAgentName[];
  annotations?: Record<string, string>;
}
