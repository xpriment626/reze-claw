// Re-export Coral API types from shared package.
// This file exists for backwards-compatible import paths within Reze.
export type {
  CreateSessionRequest,
  CreateSessionResponse,
  AgentGraphEntry,
  AgentProvider,
  AgentOptionValue,
  NamespaceProvider,
  SessionExecution,
  NamespaceState,
  NamespaceSession,
  SessionSnapshot,
  SessionSnapshotAgent,
  RegistrySource,
  RegistryAgentCatalog,
} from "@rezeclaw/coral-types/api";
