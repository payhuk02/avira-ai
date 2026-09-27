/** Kling Open Platform video models (api-singapore.klingai.com). Shared by admin UI and server. */
export type KlingModel = {
  id: string;
  label: string;
  t2vPath: string;
  i2vPath: string;
  durations?: number[];
  min?: number;
  max?: number;
  resolutions: string[];
  aspects: string[];
  /** Only send settings.audio when the model documents it (avoids 400 on Turbo / 2.5). */
  audio?: boolean;
  maxPrompt?: number;
};

export const KLING_MODELS: KlingModel[] = [
  {
    id: "kling-3.0-turbo",
    label: "Kling 3.0 Turbo",
    t2vPath: "/text-to-video/kling-3.0-turbo",
    i2vPath: "/image-to-video/kling-3.0-turbo",
    min: 3,
    max: 15,
    resolutions: ["720p", "1080p"],
    aspects: ["16:9", "9:16", "1:1"],
    maxPrompt: 2500,
  },
  {
    id: "kling-3.0",
    label: "Kling 3.0",
    t2vPath: "/text-to-video/kling-3.0",
    i2vPath: "/image-to-video/kling-3.0",
    min: 3,
    max: 15,
    resolutions: ["720p", "1080p", "4k"],
    aspects: ["16:9", "9:16", "1:1"],
    audio: true,
    maxPrompt: 2500,
  },
  {
    id: "kling-2.6",
    label: "Kling 2.6",
    t2vPath: "/text-to-video/kling-2.6",
    i2vPath: "/image-to-video/kling-2.6",
    durations: [5, 10],
    resolutions: ["720p", "1080p"],
    aspects: ["16:9", "9:16", "1:1"],
    audio: true,
    maxPrompt: 2500,
  },
  {
    id: "kling-2.5-turbo",
    label: "Kling 2.5 Turbo",
    t2vPath: "/text-to-video/kling-2.5-turbo",
    i2vPath: "/image-to-video/kling-2.5-turbo",
    durations: [5, 10],
    resolutions: ["720p", "1080p"],
    aspects: ["16:9", "9:16", "1:1"],
    maxPrompt: 2500,
  },
];

export const DEFAULT_KLING_MODEL = "kling-3.0-turbo";
export const DEFAULT_KLING_VIDEO_FALLBACKS = ["kling-3.0-turbo", "kling-2.5-turbo", "kling-2.6", "kling-3.0"];
export const KLING_MODEL_IDS = new Set(KLING_MODELS.map((m) => m.id));
