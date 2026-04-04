import { readFile, writeFile } from "fs/promises";
import Replicate from "replicate";

// Lazy init — must be called after env is loaded
let _replicate: Replicate;
function client() {
  if (!_replicate) _replicate = new Replicate();
  return _replicate;
}

export type AspectRatio =
  | "1:1"
  | "16:9"
  | "9:16"
  | "4:3"
  | "3:4"
  | "3:2"
  | "2:3"
  | "match_input_image"
  | "custom";

export type Resolution = "0.25 MP" | "0.5 MP" | "1 MP" | "2 MP" | "4 MP";

export interface GenerateOptions {
  prompt: string;
  aspectRatio?: AspectRatio;
  width?: number;
  height?: number;
  resolution?: Resolution;
  model?: string;
  outputPath?: string;
  referenceImages?: string[];
}

export async function generate(
  promptOrOpts: string | GenerateOptions
): Promise<string> {
  const opts =
    typeof promptOrOpts === "string"
      ? { prompt: promptOrOpts }
      : promptOrOpts;

  const {
    prompt,
    aspectRatio = "1:1",
    width,
    height,
    resolution = "1 MP",
    model = "black-forest-labs/flux-2-pro",
    outputPath,
    referenceImages,
  } = opts;

  const isFluxDev = model.includes("flux-2-dev") || model.includes("flux-dev");

  const input: Record<string, unknown> = {
    prompt,
    aspect_ratio: aspectRatio,
  };

  // resolution param only exists on Pro/Max, not Dev
  if (!isFluxDev) {
    input.resolution = resolution;
  }

  // width/height only take effect when aspect_ratio is "custom"
  if (aspectRatio === "custom") {
    if (!width || !height) {
      throw new Error("width and height are required when aspectRatio is 'custom'");
    }
    input.width = width;
    input.height = height;
  }

  if (referenceImages?.length) {
    const images = await Promise.all(
      referenceImages.map(async (path) => {
        const data = await readFile(path);
        const ext = path.split(".").pop()?.toLowerCase() ?? "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        return `data:${mime};base64,${data.toString("base64")}`;
      })
    );
    // Flux 2 Pro accepts up to 8 reference images via input_images array
    input.input_images = images;
  }

  const output = await client().run(model as `${string}/${string}`, { input });

  const url = (output as { url: () => string }).url();

  if (outputPath) {
    await writeFile(outputPath, output as Buffer);
  }

  return url;
}
