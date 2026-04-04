// Core domain types shared across all layers.
// Derived from coral-server Kotlin serialization classes.

/** Unique agent instance name within a session */
export type UniqueAgentName = string;

/** Thread identifier */
export type ThreadId = string;

/** Message identifier */
export type MessageId = string;

// --- Thread & Message (SessionThread, SessionThreadMessage) ---

export interface CoralThread {
  id: ThreadId;
  participants?: UniqueAgentName[];
  messages?: CoralMessage[];
}

export interface CoralMessage {
  id?: MessageId;
  threadId: ThreadId;
  senderName: UniqueAgentName;
  text: string;
  mentionNames?: UniqueAgentName[];
  timestamp?: string;
}

// --- Agent ---

export interface CoralAgent {
  name: UniqueAgentName;
  version?: string;
  summary?: string;
  description?: string;
  status?: AgentStatus;
}

export interface AgentStatus {
  type: "running" | "completed" | "error" | "pending";
  connectionStatus?: {
    type: "connected" | "disconnected";
    communicationStatus?: {
      type: "thinking" | "waiting_message" | "idle";
    };
  };
}

// --- Registry ---

export interface RegistryAgentIdentifier {
  name: string;
  version: string;
  registrySourceId: RegistrySourceId;
}

export type RegistrySourceId =
  | { type: "local" }
  | { type: "marketplace" }
  | { type: "linked"; linkedServerId: string };

export type RuntimeId = "executable" | "docker" | "function";

// --- Session ---

export interface CoralSession {
  id: string;
  namespace: string;
  status?: { type: string };
  timestamp?: string;
  agents?: CoralAgent[];
}
