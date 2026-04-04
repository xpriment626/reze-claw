import { Titlebar } from "./Titlebar";
import { SceneView } from "./SceneView";
import { ChatInput } from "./ChatInput";

interface WidgetViewProps {
  onExpand: () => void;
}

export function WidgetView({ onExpand }: WidgetViewProps) {
  const handleSend = (message: string) => {
    console.log("[RezeClaw] User:", message);
    // TODO: route to gateway agent
  };

  return (
    <div className="h-screen flex flex-col">
      <Titlebar onExpand={onExpand} />
      <SceneView />
      <ChatInput onSend={handleSend} />
    </div>
  );
}
