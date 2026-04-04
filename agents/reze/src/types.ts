// Events sent from Reze to the frontend via SSE
export type RezeEvent =
  | { type: "text"; content: string }
  | { type: "session_created"; sessionId: string; namespace: string; agents: string[] }
  | { type: "coral_event"; event: CoralWebSocketEvent }
  | { type: "error"; message: string };

// Coral WebSocket events relayed through Reze
export interface CoralWebSocketEvent {
  type: string;
  name?: string;
  threadId?: string;
  thread?: CoralThread;
  message?: CoralMessage;
  timestamp?: string;
}

export interface CoralThread {
  id: string;
  participants?: string[];
  messages?: CoralMessage[];
}

export interface CoralMessage {
  id?: string;
  senderName: string;
  text: string;
  timestamp?: string;
  threadId?: string;
  mentionNames?: string[];
}

export interface CoralAgent {
  name: string;
  version?: string;
  summary?: string;
  status?: { type: string };
}

export interface CoralSession {
  id: string;
  namespace: string;
  status?: { type: string };
  timestamp?: string;
  agents?: CoralAgent[];
}
