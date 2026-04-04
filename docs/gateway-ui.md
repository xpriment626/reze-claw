# Gateway UI — Desktop Widget

> Written 2026-04-02.

---

## Concept

RezeClaw's user-facing entrypoint is a persistent desktop widget (or lightweight desktop app) that acts as a "portal" into the agent's scene.

### Widget Components

```
┌──────────────────────────────────────────┐
│  Persistent Widget (draggable)     [⚙]  │  ← settings icon opens full gateway UI
│                                          │     (setup, config, agent management)
│                                          │
│         Character Animation              │
│         (fills the viewport)             │
│                                          │
│         Scene: room with desk,           │
│         bed, window, day/night           │
│                                          │
│  ○  [  Chat box input            ]       │
│  ↑                                       │
│  Voice mode toggle                       │
└──────────────────────────────────────────┘
```

### Interaction Modes
- **Text:** Type in the chat box, Reze responds (text rendered in-widget or as speech bubble)
- **Voice:** Toggle voice mode for STT input → agent response → TTS output

---

## Avatar & Scene — 3D Cel-Shaded ("2.5D") Approach

### Why not Live2D
- Live2D rigging is a manual, creative-heavy bottleneck
- Limited to 2D plane — can't do scene depth, camera angles, or environmental interaction
- Every new pose/expression requires manual rigging work

### The 3D Pipeline

```
1. 2D character art (existing)
   ↓
2. AI 2D-to-3D mesh generation
   ↓
3. Auto-rigging (AccuRig)
   ↓
4. Blender MCP → scene objects (room, desk, bed, window)
   ↓
5. Export to glTF/glb
   ↓
6. Three.js or Babylon.js → cel-shader rendering
   ↓
7. Rendered in gateway widget (WebGL canvas)
```

### Scene Elements
- **Room:** The primary environment — Reze's home office / bedroom
- **Desk:** Where Reze "works" (active/processing state)
- **Bed:** Lounging (idle) or sleeping (inactive/night mode)
- **Window:** Day/night cycle synced to user's local time or agent activity
- **Character model:** Reze with cel-shading to preserve anime aesthetic

### Character States (Agent-Driven)

| Agent State | Animation | Scene |
|-------------|-----------|-------|
| Active (processing task) | Sitting at desk, typing | Monitor glow, daytime |
| Idle (waiting for input) | Lounging on bed, reading | Relaxed lighting |
| Sleeping (inactive / night) | Sleeping on bed | Night, window shows moon |
| Listening (voice mode) | Turns to face camera | Slight ambient change |
| Multi-agent fan-out | At desk, multiple monitors | Busy scene |

States are driven by the gateway agent — when it creates a Coral session and fans out work, the avatar shifts to "active at desk." When idle, she moves to the bed. This creates a natural, ambient connection between agent activity and visual feedback.

---

## Tech Stack (Widget)

- **Framework:** Electron or Tauri (desktop app shell)
- **Renderer:** Three.js or Babylon.js (WebGL, cel-shader)
- **Model format:** glTF/glb (standard, well-supported)
- **Voice:** Web Speech API or Whisper (STT) + TTS engine
- **Comms:** Gateway agent WebSocket or HTTP to backend

---

## Open Questions
- Electron vs Tauri? (Tauri is lighter but Three.js ecosystem is more mature with Electron/web)
- Lip-sync: drive from TTS audio waveform or skip for v1?
- Scene complexity: how many objects before WebGL performance matters on low-end machines?
- Should the widget support resize / minimize to just the chat box?
