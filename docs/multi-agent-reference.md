# Multi-Agent Reference Patterns

> Organically discovered agent design patterns and workflows.
> These are reference architectures, not primary RezeClaw design docs.

---

## Pattern: Image Generation Pipeline (Brand-Grade)

> Discovered 2026-04-03 during Kali agent design + Coral integration planning.

### Problem

Single-agent image generation fails at brand scale because the human is the bottleneck at every quality gate: writing prompts, selecting models, curating references, evaluating outputs, diagnosing failures, and iterating. This doesn't scale to 100+ SKUs across multiple channels.

### Agent Graph

```
User
  │
  ▼
Creative Director ──────────────────────────────┐
  │ (structured creative spec)                   │ (escalation: ambiguity)
  │                                              │
  ├──► Prompt Engineer ◄──────────────────┐      │
  │     │                                 │      │
  ├──► Model Router                       │      │
  │     │                                 │      │
  ├──► Reference Curator ◄───────┐        │      │
  │     │                        │        │      │
  │     ▼                        │        │      │
  │    KALI (generate) ──► QA Checker ──► Refiner
  │                         │       │
  │                    pass │  fail  │
  │                         │        └──► routes fix to appropriate agent
  ▼                         ▼
Deliver to user        Feedback loop (bidirectional via Coral)
```

### Agents

**Creative Director**
- Role: Only agent that talks to the user. Interprets briefs, ingests brand guidelines from DB.
- Model needs: Strongest available (Grok 4.1 / GPT-5.4). Handles ambiguity, user intent.
- Output: Structured creative spec (subject, mood, palette, composition, channels, output count).

**Prompt Engineer**
- Role: Translates creative specs into model-specific prompts. Knows model quirks (e.g., Flux doesn't do negative prompts, use hex codes for color, structured JSON prompting for camera control).
- Model needs: Medium (GPT-5.4-mini). Template-driven, model-specific knowledge.
- Output: Optimized prompts per model.

**Model Router**
- Role: Selects model and strategy. Draft on Flux Dev → finalize on Pro? Use brand LoRA? Proteus for illustrative variants?
- Model needs: Lightweight (rule-based or mini). Decision tree with cost/quality heuristics.
- Output: Model ID, strategy (draft/final), budget allocation.

**Reference Curator**
- Role: Given product images in the brand library, selects which references go in which of the 8 available slots and why.
- Model needs: Medium (needs vision). Classifies images, selects slots.
- Output: Ordered reference image array with slot rationale.
- Example allocation:
  - Slots 1-2: Product angles (front, side)
  - Slot 3: Material/texture detail
  - Slot 4: Mood/lifestyle reference
  - Slot 5: Lighting reference from previous successful campaign
  - Slots 6-8: Available for style, background, or color palette references

**Kali (Generator)**
- Role: Pure execution. Takes assembled inputs, runs generations. Batches drafts on Dev, promotes winners to Pro.
- Model needs: None (API calls only, no LLM reasoning).
- Output: Raw generated images.

**QA Checker**
- Role: Evaluates each output against brand spec using vision model.
- Model needs: Medium (needs vision). Evaluates against checklist.
- Checks:
  - Product accuracy (compare against reference images)
  - Brand color tolerance
  - Composition correctness for target channel (16:9 hero vs square social)
  - Defect detection (extra fingers, warped text, impossible geometry)
- Output: Pass/fail with structured diagnosis per image.

**Refiner**
- Role: When QA fails, diagnoses *what's wrong* and routes the fix to the right agent.
- Model needs: Medium. Diagnosis from QA output, routes appropriately.
- Routing examples:
  - Wrong product shape → Reference Curator (add another angle)
  - Colors off → Prompt Engineer (add hex codes more aggressively)
  - Wrong mood → Creative Director (clarify spec)
  - Minor defect → Kali (inpaint specific region)

### Why Bidirectional Comms Matter (Coral)

In a traditional orchestrator pattern, failures route back to a central coordinator, which re-dispatches top-down. The orchestrator becomes the bottleneck and loses context with each round-trip.

With Coral's peer-to-peer messaging:

- **Refiner → Prompt Engineer:** "The bag hardware is getting lost in warm lighting. Add 'prominent gold clasp detail catching direct light' to the prompt."
- **QA → Creative Director:** "Output 3 is technically off-brand (background skews blue) but has the best composition. Accept or regenerate?"
- **Reference Curator → QA:** "You've rejected 3 outputs for incorrect material texture. Adding a macro leather grain shot as reference 4. Does that address it?"
- **Prompt Engineer → Model Router:** "Text rendering keeps failing after 3 prompt variations. Should we switch from Proteus to Flux 2 Pro?"

Agents negotiate among themselves. Only genuine ambiguities escalate to the user via Creative Director.

### Cost Profile

| Agent | Model tier | Est. cost/invocation |
|-------|-----------|---------------------|
| Creative Director | Grok 4.1 / GPT-5.4 | ~$0.01-0.03 |
| Prompt Engineer | GPT-5.4-mini | ~$0.001-0.003 |
| Model Router | Rule-based / nano | ~$0.0001 |
| Reference Curator | Vision model (mini) | ~$0.002-0.005 |
| Kali (draft batch) | 10x Flux Dev | $0.03 |
| Kali (final) | 1-3x Flux 2 Pro | $0.035-0.105 |
| QA Checker | Vision model (mini) | ~$0.002-0.005 |
| Refiner | GPT-5.4-mini | ~$0.001-0.003 |
| **Total per hero shot** | | **~$0.10-0.20** |

At scale: 100 SKUs × 3 channels × $0.15 avg = **~$45** for an entire product catalog shoot. Compare to traditional product photography costs.

### Key Insight

Only 1 of 7 agents needs an expensive model. The rest are mini/nano tier or rule-based. The bottleneck is agent reasoning, not image generation — which is exactly where horizontal scaling through Coral pays off.

---

*More patterns will be added here as they emerge during development.*
