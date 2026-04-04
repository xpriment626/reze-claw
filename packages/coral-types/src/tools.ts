// Coral MCP tool input/output types.
// Derived from coral-server/src/main/kotlin/.../mcp/tools/*.kt

import type { UniqueAgentName, ThreadId, CoralThread, CoralMessage } from "./domain.js";

// --- coral_create_thread ---

export interface CreateThreadInput {
  threadName: string;
  participantNames: UniqueAgentName[];
}

export interface CreateThreadOutput {
  thread: CoralThread;
}

// --- coral_close_thread ---

export interface CloseThreadInput {
  threadId: ThreadId;
}

// --- coral_add_participant ---

export interface AddParticipantInput {
  threadId: ThreadId;
  participantName: UniqueAgentName;
}

// --- coral_remove_participant ---

export interface RemoveParticipantInput {
  threadId: ThreadId;
  participantName: UniqueAgentName;
}

// --- coral_send_message ---

export interface SendMessageInput {
  threadId: ThreadId;
  content: string;
  mentions: UniqueAgentName[];
}

export interface SendMessageOutput {
  status: string;
  message: CoralMessage;
}

// --- coral_wait_for_message (takes no input) ---

export type WaitForMessageInput = Record<string, never>;

// --- coral_wait_for_mention (takes no input) ---

export type WaitForMentionInput = Record<string, never>;

// --- coral_wait_for_agent ---

export interface WaitForAgentInput {
  agentName: UniqueAgentName;
}

// --- Shared wait output (used by all three wait tools) ---

export interface WaitForMessageOutput {
  status: string;
  message: CoralMessage | null;
}

// --- coral_close_session (takes no input) ---

export type CloseSessionInput = Record<string, never>;
