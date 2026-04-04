import { useState } from "react";

interface ChatInputProps {
  onSend: (message: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSend(message.trim());
    setMessage("");
  };

  return (
    <div className="px-3 py-3 bg-claw-900/80 backdrop-blur-sm border-t border-claw-700/50">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setVoiceMode(!voiceMode)}
          className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${
            voiceMode
              ? "bg-accent text-white"
              : "bg-claw-800 text-claw-400 hover:text-claw-200"
          }`}
          title={voiceMode ? "Switch to text" : "Switch to voice"}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="1" width="4" height="8" rx="2" />
            <path d="M2 6a5 5 0 0010 0" />
            <path d="M7 11v2" />
          </svg>
        </button>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={voiceMode ? "Voice mode active..." : "Message Reze..."}
          disabled={voiceMode}
          className="flex-1 bg-claw-800 border border-claw-700/50 rounded-lg px-3 py-2 text-sm text-claw-100 placeholder:text-claw-500 focus:outline-none focus:border-accent/50 disabled:opacity-50 transition-colors"
        />
        {!voiceMode && (
          <button
            type="submit"
            disabled={!message.trim()}
            className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-accent hover:bg-accent-light text-white disabled:opacity-30 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L6 8" />
              <path d="M12 2L8 12L6 8L2 6L12 2Z" />
            </svg>
          </button>
        )}
      </form>
    </div>
  );
}
