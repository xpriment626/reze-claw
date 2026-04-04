import { useState } from "react";
import { Titlebar } from "./Titlebar";
import { SceneView } from "./SceneView";
import { ChatInput } from "./ChatInput";

interface WidgetViewProps {
  onExpand: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function WidgetView({ onExpand }: WidgetViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSend = async (message: string) => {
    setMessages((prev) => [...prev, { role: "user", content: message }]);

    try {
      const rezeBase = "__TAURI_INTERNALS__" in window ? "http://localhost:3001" : "/reze";
      const res = await fetch(`${rezeBase}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "[Error: Reze not reachable]" },
        ]);
        return;
      }

      // Read SSE response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          // Parse SSE lines
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data:")) {
              try {
                const parsed = JSON.parse(line.slice(5).trim());
                if (parsed.type === "text") {
                  assistantContent += parsed.content;
                }
              } catch {
                // partial data
              }
            }
          }
        }
      }

      if (assistantContent) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: assistantContent },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "[Error: Failed to reach Reze]" },
      ]);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Titlebar onExpand={onExpand} />
      <div className="flex-1 relative bg-claw-950 overflow-hidden">
        {messages.length === 0 ? (
          <SceneView />
        ) : (
          <div className="h-full overflow-y-auto p-3 space-y-2">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`text-xs px-3 py-2 rounded-lg max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-accent/20 text-claw-100 ml-auto"
                    : "bg-claw-800 text-claw-300"
                }`}
              >
                {msg.content}
              </div>
            ))}
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} />
    </div>
  );
}
