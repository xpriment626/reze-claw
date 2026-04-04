// Coral WebSocket event types and Reze SSE event types.
// WebSocket events: broadcast by Coral server per session.
// Reze events: sent from Reze gateway to frontend via SSE.

import type { UniqueAgentName, ThreadId, CoralThread, CoralMessage } from "./domain.js";

// --- Coral WebSocket events ---

export interface CoralWebSocketEvent {
  type: CoralEventType;
  name?: UniqueAgentName;
  threadId?: ThreadId;
  thread?: CoralThread;
  message?: CoralMessage;
  timestamp?: string;
}

export type CoralEventType =
  | "runtime_started"
  | "runtime_stopped"
  | "agent_connected"
  | "agent_disconnected"
  | "agent_wait_start"
  | "agent_wait_stop"
  | "thread_created"
  | "thread_closed"
  | "thread_participant_added"
  | "thread_participant_removed"
  | "thread_message_sent"
  | "session_closed"
  | (string & {});  // allow unknown event types without losing autocomplete

// --- Reze SSE events (Reze -> Frontend) ---

export type RezeEvent =
  | { type: "text"; content: string }
  | { type: "session_created"; sessionId: string; namespace: string; agents: string[] }
  | { type: "coral_event"; event: CoralWebSocketEvent }
  | { type: "error"; message: string };
