const DEFAULT_SCENE = "/reze-prone.webp";

export function SceneView() {
  return (
    <div className="flex-1 relative bg-claw-950 overflow-hidden">
      <img
        src={DEFAULT_SCENE}
        alt="Reze"
        className="w-full h-full object-cover"
      />

      {/* Status indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-claw-900/70 backdrop-blur-sm">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] text-claw-400">Idle</span>
      </div>
    </div>
  );
}
