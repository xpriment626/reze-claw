# Kali — Model Routing Reference

> General-purpose image generation agent. Routes to optimal model based on task requirements.
> Written 2026-04-03.

---

## Default Model

**Flux 2 Pro** (`black-forest-labs/flux-2-pro`) — $0.035/image, score 4.53/5.0

Best general-purpose model on Replicate. Supports reference images (up to 8), structured JSON prompting, image editing, and text rendering. Handles anime, photorealism, product shots, and concept art through prompt engineering alone.

---

## Routing Table

| Intent | Model | Cost | Why |
|--------|-------|------|-----|
| **Default / production output** | Flux 2 Pro | $0.035 | Best value. 99.6% of Max quality at half the price. |
| **Draft / iteration / batch exploration** | Flux Dev | $0.003 | 92% of Pro quality at 1/10th cost. Generate 10 variations for $0.03, pick the best, upscale to Pro. |
| **Thumbnail / quick preview** | Flux Schnell | $0.001 | Near-instant. Good enough for UI previews and layout drafts. |
| **Maximum fidelity final output** | Flux 2 Max | $0.070 | Only when pixel-perfect matters. 0.016 better than Pro at 2x cost. |
| **Anime scene (no ref needed)** | datacte/proteus-v0.3 | ~$0.005 | Natively anime-tuned SDXL. 5.6M runs. Best for scenes where character identity isn't critical. |
| **Anime full-scene illustration** | charlesmccarthy/animagine-xl | ~$0.008 | Structured scenes with characters + backgrounds. Strong identity consistency. |
| **Style transfer (Ghibli)** | aaronaftab/mirage-ghibli | ~$0.01 | Img2img only. Painterly Ghibli aesthetic. |
| **Style transfer (cartoon)** | flux-kontext-apps/cartoonify | ~$0.005 | Img2img only. Broad cartoon stylization. |
| **Brand-specific / trained LoRA** | Custom Flux LoRA | varies | See "LoRA Training Pipeline" below. |

### Routing Logic (future)

```
if (task.requiresCharacterRef)     → flux-2-pro (only model with multi-ref support)
if (task.style === "anime" && !ref) → proteus-v0.3 (cheaper, natively tuned)
if (task.mode === "draft")          → flux-dev (iterate cheap, promote winner)
if (task.mode === "preview")        → flux-schnell (sub-second)
if (task.hasTrainedLoRA)            → custom model (brand-specific)
if (task.maxFidelity)               → flux-2-max
else                                → flux-2-pro
```

---

## LoRA Training Pipeline (end-state)

Use case: client ingests a library of reference images (product photos, brand assets, character art), Kali trains a brand-specific LoRA, then generates outputs tuned to that visual identity.

### Flow

```
1. Client uploads reference image library (10-50 images)
2. Kali triggers LoRA training on Replicate (Flux Dev as base)
   - Replicate supports training custom models via API
   - Training takes ~15-30 min depending on dataset size
3. Trained LoRA is hosted on Replicate as a custom model
4. Kali routes generation requests to the custom model
5. Draft outputs on trained LoRA → final outputs via Flux 2 Pro with LoRA style prompting
```

### Example: E-commerce brand

```
Input:  50 product photos from a skincare brand
Train:  LoRA captures lighting style, background palette, product composition
Output: Generate new product shots, lifestyle images, social media content
        all matching the brand's visual identity
```

### Training via Replicate API

```typescript
const training = await replicate.trainings.create(
  "owner/model",
  "version-id",
  {
    destination: "owner/trained-model",
    input: {
      input_images: "https://...",  // zip of training images
      trigger_word: "BRANDSTYLE",
      steps: 1000,
    },
  }
);
```

---

## Models NOT worth using

| Model | Why skip |
|-------|----------|
| Flux 1.1 Pro | Strictly worse than Flux 2 Pro at higher price ($0.040 vs $0.035). |
| cjwbw/anything-v4.0 | SD 1.5 architecture — lower resolution ceiling, older tech. Only useful if you need the cheapest possible anime output. |

---

## Cost estimation for common workflows

| Workflow | Models used | Est. cost |
|----------|------------|-----------|
| Single polished image | 1x Pro | $0.035 |
| 10 drafts → pick best → final | 10x Dev + 1x Pro | $0.065 |
| Brand LoRA training + 50 outputs | Training + 50x Dev | ~$5-10 |
| Batch: 100 social media images | 100x Dev drafts + 20x Pro finals | ~$1.00 |
