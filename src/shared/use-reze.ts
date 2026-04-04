import { useState, useEffect, useCallback, useRef } from "react";

const REZE_BASE = "/reze";

// --- Types ---

export interface RezeAgent {
  name: string;
  version?: string;
  status?: string;
}

export interface RezeSession {
  id: string;
  namespace: string;
  status?: string;
  timestamp?: string;
}

export interface RezeSessionSnapshot {
  agents?: Record<string, unknown> | unknown[];
  threads?: {
    id?: string;
    participants?: string[];
    messages?: {
      id?: string;
      senderName?: string;
      text?: string;
      timestamp?: string;
      threadId?: string;
      mentionNames?: string[];
    }[];
  }[];
}

export interface CoralEvent {
  type: string;
  name?: string;
  threadId?: string;
  message?: {
    senderName?: string;
    text?: string;
    timestamp?: string;
    threadId?: string;
    mentionNames?: string[];
  };
  timestamp?: string;
}

// --- Health ---

export function useRezeHealth() {
  const [status, setStatus] = useState<{ status: string; coral: string } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(`${REZE_BASE}/health`);
        setStatus(await res.json());
      } catch {
        setStatus(null);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  return status;
}

// --- Agents ---

export function useAgents() {
  const [agents, setAgents] = useState<RezeAgent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${REZE_BASE}/agents`);
      if (res.ok) setAgents(await res.json());
    } catch {
      // Reze not running
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { agents, loading, refresh };
}

// --- Sessions ---

export function useSessions() {
  const [sessions, setSessions] = useState<RezeSession[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${REZE_BASE}/sessions`);
      if (res.ok) setSessions(await res.json());
    } catch {
      // Reze not running
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { sessions, loading, refresh };
}

// --- Session Detail (SSE) ---

export function useSessionEvents(namespace: string, sessionId: string) {
  const [snapshot, setSnapshot] = useState<RezeSessionSnapshot | null>(null);
  const [events, setEvents] = useState<CoralEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = `${REZE_BASE}/session/${encodeURIComponent(namespace)}/${encodeURIComponent(sessionId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (e) => {
      try {
        setSnapshot(JSON.parse(e.data));
        setConnected(true);
      } catch {
        // bad data
      }
    });

    es.addEventListener("coral_event", (e) => {
      try {
        const event: CoralEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
      } catch {
        // bad data
      }
    });

    es.addEventListener("ping", () => {
      // keepalive, ignore
    });

    es.addEventListener("error", () => {
      setConnected(false);
    });

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [namespace, sessionId]);

  return { snapshot, events, connected };
}
