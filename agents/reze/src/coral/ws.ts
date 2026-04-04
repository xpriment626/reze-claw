import type { CoralWebSocketEvent } from "../types.js";

type EventListener = (event: CoralWebSocketEvent) => void;

export class CoralWebSocketRelay {
  private sockets = new Map<string, WebSocket>();
  private listeners = new Map<string, Set<EventListener>>();

  constructor(
    private wsBase: string,
    private authToken: string
  ) {}

  /** Build the WS URL for a session */
  private buildUrl(namespace: string, sessionId: string): string {
    const ns = encodeURIComponent(namespace);
    const sid = encodeURIComponent(sessionId);
    const token = encodeURIComponent(this.authToken);
    return `${this.wsBase}/ws/v1/events/${token}/session/${ns}/${sid}`;
  }

  /** Get a unique key for a session */
  private key(namespace: string, sessionId: string): string {
    return `${namespace}/${sessionId}`;
  }

  /** Subscribe to events for a session. Returns an unsubscribe function. */
  subscribe(
    namespace: string,
    sessionId: string,
    listener: EventListener
  ): () => void {
    const k = this.key(namespace, sessionId);

    // Register listener
    if (!this.listeners.has(k)) {
      this.listeners.set(k, new Set());
    }
    this.listeners.get(k)!.add(listener);

    // Connect WebSocket if not already connected for this session
    if (!this.sockets.has(k)) {
      this.connect(namespace, sessionId, k);
    }

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(k);
      if (set) {
        set.delete(listener);
        // If no more listeners, close the socket
        if (set.size === 0) {
          this.listeners.delete(k);
          const ws = this.sockets.get(k);
          if (ws) {
            ws.close();
            this.sockets.delete(k);
          }
        }
      }
    };
  }

  private connect(namespace: string, sessionId: string, key: string): void {
    const url = this.buildUrl(namespace, sessionId);
    const ws = new WebSocket(url);

    ws.onmessage = (evt) => {
      try {
        const event: CoralWebSocketEvent = JSON.parse(
          typeof evt.data === "string" ? evt.data : evt.data.toString()
        );
        const set = this.listeners.get(key);
        if (set) {
          for (const listener of set) {
            listener(event);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      this.sockets.delete(key);
      // Reconnect if there are still listeners
      if (this.listeners.has(key) && this.listeners.get(key)!.size > 0) {
        setTimeout(() => {
          if (this.listeners.has(key) && this.listeners.get(key)!.size > 0) {
            this.connect(namespace, sessionId, key);
          }
        }, 2500);
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };

    this.sockets.set(key, ws);
  }

  /** Close all connections */
  closeAll(): void {
    for (const ws of this.sockets.values()) {
      ws.close();
    }
    this.sockets.clear();
    this.listeners.clear();
  }
}
