import { useParams, useNavigate } from "react-router-dom";
import { useSessionEvents } from "@/shared/use-reze";
import type { CoralWebSocketEvent } from "@rezeclaw/coral-types/events";

export function SessionDetailView() {
  const { namespace, sessionId } = useParams<{ namespace: string; sessionId: string }>();
  const navigate = useNavigate();

  if (!namespace || !sessionId) {
    return <div className="p-6 text-claw-500">Invalid session URL</div>;
  }

  return <SessionDetail namespace={namespace} sessionId={sessionId} onBack={() => navigate("/sessions")} />;
}

function SessionDetail({
  namespace,
  sessionId,
  onBack,
}: {
  namespace: string;
  sessionId: string;
  onBack: () => void;
}) {
  const { snapshot, events, connected } = useSessionEvents(namespace, sessionId);

  // Merge snapshot messages + live events into a unified timeline
  const snapshotMessages =
    snapshot?.threads?.flatMap((t) =>
      (t.messages ?? []).map((m) => ({
        kind: "message" as const,
        senderName: m.senderName ?? "unknown",
        text: m.text ?? "",
        timestamp: m.timestamp,
        threadId: m.threadId ?? t.id,
      }))
    ) ?? [];

  const liveItems = events.map((e) => eventToTimelineItem(e));

  const timeline = [
    ...snapshotMessages.map((m) => ({
      ...m,
      key: `snap-${m.timestamp}-${m.senderName}`,
    })),
    ...liveItems.map((item, i) => ({
      ...item,
      key: `live-${i}`,
    })),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-claw-700/50">
        <button
          onClick={onBack}
          className="text-claw-400 hover:text-claw-100 transition-colors text-sm"
        >
          &larr; Back
        </button>
        <div className="flex-1">
          <span className="text-sm font-medium text-claw-100 font-mono">
            {sessionId.slice(0, 8)}...
          </span>
          <span className="text-xs text-claw-500 ml-2">{namespace}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-claw-500"}`}
          />
          <span className="text-[10px] text-claw-500">
            {connected ? "live" : "connecting..."}
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {timeline.length === 0 && (
          <div className="text-center text-claw-500 text-sm py-8">
            Waiting for events...
          </div>
        )}

        {timeline.map((item) =>
          item.kind === "message" ? (
            <MessageBubble
              key={item.key}
              sender={item.senderName}
              text={item.text}
              timestamp={item.timestamp}
            />
          ) : (
            <SystemEvent key={item.key} text={item.text} />
          )
        )}
      </div>
    </div>
  );
}

function MessageBubble({
  sender,
  text,
  timestamp,
}: {
  sender: string;
  text: string;
  timestamp?: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-[10px] font-bold text-accent-light uppercase">
          {sender.slice(0, 2)}
        </span>
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-xs font-medium text-claw-200">{sender}</span>
          {timestamp && (
            <span className="text-[10px] text-claw-600">
              {new Date(timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="text-sm text-claw-300 bg-claw-800/50 rounded-lg px-3 py-2 inline-block border border-claw-700/20">
          {text}
        </div>
      </div>
    </div>
  );
}

function SystemEvent({ text }: { text: string }) {
  return (
    <div className="flex justify-center">
      <span className="text-[10px] text-claw-600 bg-claw-900/50 px-3 py-1 rounded-full">
        {text}
      </span>
    </div>
  );
}

function eventToTimelineItem(event: CoralWebSocketEvent): {
  kind: "message" | "system";
  senderName: string;
  text: string;
  timestamp?: string;
} {
  if (event.type === "thread_message_sent" && event.message) {
    return {
      kind: "message",
      senderName: event.message.senderName ?? "unknown",
      text: event.message.text ?? "",
      timestamp: event.message.timestamp ?? event.timestamp,
    };
  }

  // All other events -> system messages
  const labels: Record<string, string> = {
    runtime_started: `${event.name ?? "agent"} container started`,
    runtime_stopped: `${event.name ?? "agent"} container stopped`,
    agent_connected: `${event.name ?? "agent"} connected to Coral`,
    agent_wait_start: `${event.name ?? "agent"} waiting...`,
    agent_wait_stop: `${event.name ?? "agent"} resumed`,
    thread_created: "thread created",
    thread_closed: "thread closed",
    thread_participant_added: `${event.name ?? "agent"} joined thread`,
    thread_participant_removed: `${event.name ?? "agent"} left thread`,
  };

  return {
    kind: "system",
    senderName: "system",
    text: labels[event.type] ?? event.type,
    timestamp: event.timestamp,
  };
}
