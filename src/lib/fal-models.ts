/** Fal.ai queue video models (queue.fal.run). Shared by admin UI and server. */
export type FalModel = {
  id: string;
  label: string;
  /** Separate endpoint for image→video when it differs from text→video. */
  i2vId?: string;
  /** Allowed durations in seconds. */
  durations: number[];
  /** How duration is serialized in the JSON body. */
  durationStyle: "string" | "seconds_suffix";
  resolutions: string[];
  aspects: string[];
  /** Include generate_audio: true when the model supports it. */
  audio?: boolean;
  maxPrompt?: number;
};

export const FAL_MODELS: FalModel[] = [
  {
    id: "bytedance/seedance-2.0/fast/text-to-video",
    label: "Seedance 2.0 Fast",
    i2vId: "bytedance/seedance-2.0/fast/image-to-video",
    durations: [4, 5, 6, 7, 8, 9, 10],
    durationStyle: "string",
    resolutions: ["480p", "720p"],
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    audio: true,
    maxPrompt: 2500,
  },
  {
    id: "bytedance/seedance-2.0/text-to-video",
    label: "Seedance 2.0",
    i2vId: "bytedance/seedance-2.0/image-to-video",
    durations: [4, 5, 6, 7, 8, 9, 10],
    durationStyle: "string",
    resolutions: ["480p", "720p"],
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    audio: true,
    maxPrompt: 2500,
  },
  {
    id: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    label: "Seedance 1.5 Pro",
    i2vId: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    durations: [4, 5, 6, 7, 8, 9, 10],
    durationStyle: "string",
    resolutions: ["480p", "720p", "1080p"],
    aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    audio: true,
    maxPrompt: 2500,
  },
  {
    id: "fal-ai/minimax/hailuo-2.3/standard/text-to-video",
    label: "Hailuo 2.3",
    i2vId: "fal-ai/minimax/hailuo-2.3/standard/image-to-video",
    durations: [6, 10],
    durationStyle: "string",
    resolutions: ["720p"],
    aspects: ["16:9", "9:16"],
    maxPrompt: 2000,
  },
  {
    id: "fal-ai/veo3.1/fast",
    label: "Veo 3.1 Fast (via Fal)",
    i2vId: "fal-ai/veo3.1/fast/image-to-video",
    durations: [4, 6, 8],
    durationStyle: "seconds_suffix",
    resolutions: ["720p", "1080p", "4k"],
    aspects: ["16:9", "9:16"],
    audio: true,
    maxPrompt: 4000,
  },
  {
    id: "fal-ai/veo3.1",
    label: "Veo 3.1 (via Fal)",
    i2vId: "fal-ai/veo3.1/image-to-video",
    durations: [4, 6, 8],
    durationStyle: "seconds_suffix",
    resolutions: ["720p", "1080p", "4k"],
    aspects: ["16:9", "9:16"],
    audio: true,
    maxPrompt: 4000,
  },
];

export const DEFAULT_FAL_MODEL = "bytedance/seedance-2.0/fast/text-to-video";
export const DEFAULT_FAL_VIDEO_FALLBACKS = [
  "fal-ai/minimax/hailuo-2.3/standard/text-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  "fal-ai/veo3.1/fast",
];
export const FAL_MODEL_IDS = new Set(FAL_MODELS.map((m) => m.id));
