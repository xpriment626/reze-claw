# Flux Prompt Engineering Skill

> Empirically derived prompt construction rules for Black Forest Labs Flux models (Dev, Pro, Max).
> Discovered through iterative testing on RezeClaw character generation, 2026-04-03.

---

## Core Rules

### 1. Lead with style

The first sentence sets the visual domain for the entire generation. Everything after is interpreted through this lens.

```
✓ "Anime illustration in a precise, clean cel-shaded art style matching the character reference in image 1 as closely as possible."
✗ "A young woman with purple hair sitting at a desk..." (style is implicit, model defaults to photorealism)
```

### 2. Anchor reference fidelity explicitly

The model won't prioritize matching a reference image unless you tell it to. Say it twice — once at the top, once at the bottom.

```
Top:    "...matching the character reference in image 1 as closely as possible"
Bottom: "Maintain the sharp linework and flat cel-shaded coloring style of the reference art."
```

Without this, reference images are treated as loose suggestions, not constraints.

### 3. Describe environments with mood, not architecture

Vibe-driven descriptions produce stylistically coherent scenes. Architectural specs push toward photorealism and clash with anime/illustrated characters.

```
✓ "a small bedroom-office with warm ambient lamp lighting, a bed with dark rumpled sheets in the background, a large window showing a dusky purple-orange evening skyline"
✗ "Rich dark hardwood floors, recessed ceiling spots and a pendant bedside lamp, tall upholstered navy headboard panel, deep L-shaped dark wood desk"
```

The model infers proportions, materials, and layout details that are coherent with the character's art style when given mood. When given specs, it renders the room realistically and the character separately.

### 4. Write one flowing scene, not modular templates

Prompts that read like a narrative scene description outperform concatenated template blocks.

```
✓ "She faces a dual-monitor setup with code on the screens, one hand resting on the keyboard, looking over her shoulder toward the viewer with a slight confident smirk. The room has warm ambient lamp lighting..."

✗ CHARACTER_BLOCK + ROOM_BLOCK + ACTION_BLOCK
```

Narrative flow tells the model how elements relate spatially and tonally. Modular blocks are processed as independent specs, producing compositions that feel like collages.

### 5. Fewer references > more references

One strong reference image with high fidelity instruction outperforms multiple references that the model has to average across.

| References | Outcome |
|-----------|---------|
| 1 (official art, clean linework) | Model commits fully, strong style match |
| 3 (official + casual + portrait) | Model averages across styles, weakens all |
| 4 (3 character + 1 photorealistic interior) | Style domain clash — anime character in semi-realistic room |

**When to use multiple refs:** Only when they're stylistically consistent (same artist, same medium) and each adds genuinely different information (e.g., front angle + side angle of the same character in the same art style).

### 6. Shorter prompts > longer prompts

Every word dilutes the signal. The winning prompt was ~150 words. The losing batch prompts were 250+. Extra words don't add precision — they add ambiguity.

Prioritize by sentence position:
1. Style and medium
2. Character description + reference anchor
3. Action and pose
4. Environment (mood-driven)
5. Specific details (props, lighting accents)
6. Style reinforcement closing

If a detail isn't load-bearing for the composition, cut it.

### 7. Explicit anatomy for complex poses

When a pose involves limb overlap, foreshortening, or occlusion (prone, crossed legs, arms behind head), add an explicit anatomical count. This doesn't guarantee correctness but significantly shifts the odds.

```
✓ "two legs together, feet crossed at the ankles — exactly two feet visible, naturally proportioned"
✗ "lying prone on the bed" (model infers limb positions, ~20% anatomy failure rate)
```

Combined with a batch size of 3, this approach produces at least one anatomically clean output with ~95%+ confidence.

**However** — see Rule 8 below. Explicit anatomy counts are a fallback, not the default. Inference-first framing is preferred.

### 8. Constrain high-confidence elements, infer the rest

The model behaves as if it assigns an internal confidence score to each element in the scene and allocates rendering quality accordingly. Elements with strong signal (face from portrait ref, style from explicit instruction) resolve cleanly. Elements with weak signal (exact foot placement, digit geometry) resolve last and with the least certainty.

**The key insight: adding detail to low-confidence areas makes them worse, not better.** Over-specifying forces the model into a deterministic rendering path for elements it can't resolve, producing artifacts. Leaving those areas open lets the model choose compositions that naturally route around uncertainty.

**High-confidence → specify (these become anchors):**
- Art style, medium, color palette
- Facial features (especially with portrait reference)
- Pose intent (sitting, standing, prone)
- Mood and atmosphere

**Low-confidence → leave to inference (let the model route around):**
- Exact limb placement and digit counts
- Foreshortened body parts
- Complex overlapping geometry
- Architectural details and spatial measurements

Example — prone pose:
```
✗ "lying prone, two legs together, feet crossed at the ankles — exactly two feet visible, naturally proportioned"
   → forces the model to render feet it can't resolve → extra limbs, fused joints

✓ "lying prone on a bed, propped up on her elbows, facing the camera with a laptop open in front of her"
   → model naturally crops or occludes the lower body, avoids low-confidence regions entirely
```

The model's "confident exit" from a low-confidence region (e.g., hoodie covering lower body, a close crop that avoids feet) is almost always better than a forced attempt at rendering it.

**Principle: describe intent, not geometry. Constrain what the model can confidently render. For everything else, trust inference.**

### 9. Portrait reference > full-body reference

A single facial close-up reference outperforms a full-body reference (or multiple references) for character-in-scene generation. The model extrapolates body proportions from the art style better than it composites them from a separate full-body ref.

```
✓ 1 portrait close-up → model infers body proportions coherent with art style
✗ 1 full-body ref → model tries to replicate exact proportions, often distorts in new poses
✗ 3 refs (full-body + casual + portrait) → model averages across styles, weakens all
```

The facial close-up provides the highest-signal information — the features that make the character recognizable (eyes, hair, expression). The model fills in the rest coherently, the same way it infers a stylistically appropriate interior from mood description rather than architectural specs.

This is the same principle as Rules 3 and 8: **the model's inference > your specification** for elements where the model has a strong style prior to draw from.

---

## Flux Model-Specific Notes

### Aspect ratio

Flux uses `aspect_ratio` as the dimension control, not `width`/`height`. Raw width/height params are silently ignored unless `aspect_ratio` is set to `"custom"`.

```
✓ { aspect_ratio: "16:9" }
✗ { width: 1280, height: 720 }  // ignored, defaults to 1:1
```

### Reference image limits

| Model | Max reference images |
|-------|---------------------|
| Flux 2 Pro | 8 |
| Flux 2 Max | 8 |
| Flux 2 Dev | 4 |

### No negative prompts

Flux doesn't support negative prompts. "no extra fingers" may cause extra fingers. Describe what you want, not what you don't want.

```
✓ "Clean background with natural hands at rest"
✗ "no cluttered background, no extra fingers"
```

### Resolution param

`resolution` exists on Pro/Max but not on Dev. Dev ignores it.

---

## Reference: Prompt Template

For character-in-scene generations using a single reference:

```
[Style and medium]. [Reference fidelity anchor].

[Character description — physical traits, outfit, expression]. [Action and pose, with anatomical specifics if complex]. [Environment — mood-driven, atmospheric, not architectural].

[Props and details]. [Color palette]. [Style reinforcement closing].
```

Example:
```
Anime illustration in a precise, clean cel-shaded art style matching
the character reference in image 1 as closely as possible.
Wide 16:9 landscape composition.

The same young woman from the reference — short dark purple-indigo
hair with a small bun, bright green eyes, slim build — but wearing
cozy home clothes: an oversized dark hoodie unzipped over a simple
tank top, soft shorts, and bare feet. She is sitting cross-legged
in an office chair at a desk in a small bedroom-office.

She faces a dual-monitor setup with code on the screens, one hand
resting on the keyboard, looking over her shoulder toward the viewer
with a slight confident smirk. The room has warm ambient lamp lighting,
a bed with dark rumpled sheets in the background, a large window
showing a dusky purple-orange evening skyline with city lights.
Desk items: steaming coffee mug, over-ear headphones, a small potted
plant, scattered sticky notes. The color palette is muted purple,
warm amber, and soft teal accents. Maintain the sharp linework and
flat cel-shaded coloring style of the reference art.
```
