/** Runway Dev video models (docs.dev.runwayml.com, API version 2024-11-06). Shared by admin UI and server. */
export type RunwayModel = {
  id: string;
  label: string;
  t2v: boolean;
  i2v: boolean;
  /** Fixed allowed durations (e.g. Veo). */
  durations?: number[];
  min?: number;
  max?: number;
  /** Ratios for text-to-video (and for i2v when i2vRatios is omitted). */
  ratios?: string[];
  /** Override ratios for image-to-video when they differ from t2v. */
  i2vRatios?: string[];
  /** Models that take a resolution tier (`480p`, `720p`, …). */
  resolutions?: string[];
  /** i2v: aspect follows the input image — omit `ratio`, send resolution if listed. */
  i2vRatioFromImage?: boolean;
  /** i2v keyframe: use auto_480p / auto_720p / auto_1080p instead of pixel ratios (Wan). */
  i2vAutoRatio?: boolean;
  /** Max promptText length (UTF-16 units per API). Default 1000. */
  maxPrompt?: number;
};

const GEN45_I2V = ["1280:720", "720:1280", "1104:832", "960:960", "832:1104", "1584:672"];
const VEO = ["1280:720", "720:1280", "1080:1920", "1920:1080"];
const SEEDANCE = ["992:432", "864:496", "752:560", "640:640", "560:752", "496:864", "1470:630", "1280:720", "1112:834", "960:960", "834:1112", "720:1280"];
const SEEDANCE_HD = [...SEEDANCE, "2206:946", "1920:1080", "1664:1248", "1440:1440", "1248:1664", "1080:1920"];
const SEEDANCE_4K = ["3840:1646", "3840:2160", "3840:2880", "3840:3840", "2880:3840", "2160:3840"];
/** Seedance 2.5 uses 854×480 (not 864×496) at 480p. */
const SEEDANCE_25 = [
  "992:432", "854:480", "752:560", "640:640", "560:752", "480:854",
  "1470:630", "1280:720", "1112:834", "960:960", "834:1112", "720:1280",
  "2206:946", "1920:1080", "1664:1248", "1440:1440", "1248:1664", "1080:1920",
];
const WAN = [
  "832:480", "720:544", "624:624", "544:720", "480:832",
  "1280:720", "1104:832", "960:960", "832:1104", "720:1280",
  "1920:1080", "1648:1248", "1440:1440", "1248:1648", "1080:1920",
];
const HAILUO_ASPECT = ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
const GROK_ASPECT = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"];
const HAPPYHORSE = [
  "1280:720", "720:1280", "960:960", "1108:832", "832:1108",
  "1920:1080", "1080:1920", "1440:1440", "1662:1248", "1248:1662",
];
const GEMINI_11 = ["640:360", "360:640", "1280:720", "720:1280", "1920:1080", "1080:1920", "3840:2160", "2160:3840"];

/** All text_to_video / image_to_video models from the Runway Dev API. */
export const RUNWAY_MODELS: RunwayModel[] = [
  {
    id: "gen4.5",
    label: "Runway Gen-4.5",
    t2v: true,
    i2v: true,
    min: 2,
    max: 10,
    ratios: ["1280:720", "720:1280"],
    i2vRatios: GEN45_I2V,
    maxPrompt: 1000,
  },
  {
    id: "gen4_turbo",
    label: "Runway Gen-4 Turbo",
    t2v: false,
    i2v: true,
    min: 2,
    max: 10,
    ratios: GEN45_I2V,
    maxPrompt: 1000,
  },
  {
    id: "veo3.1",
    label: "Google Veo 3.1",
    t2v: true,
    i2v: true,
    durations: [4, 6, 8],
    ratios: VEO,
    maxPrompt: 1000,
  },
  {
    id: "veo3.1_fast",
    label: "Google Veo 3.1 Fast",
    t2v: true,
    i2v: true,
    durations: [4, 6, 8],
    ratios: VEO,
    maxPrompt: 1000,
  },
  {
    id: "gemini_omni_flash_1.1",
    label: "Gemini Omni Flash 1.1",
    t2v: true,
    i2v: true,
    min: 3,
    max: 10,
    ratios: GEMINI_11,
    maxPrompt: 4000,
  },
  {
    id: "gemini_omni_flash",
    label: "Gemini Omni Flash",
    t2v: true,
    i2v: true,
    min: 3,
    max: 10,
    ratios: ["1280:720", "720:1280"],
    maxPrompt: 4000,
  },
  {
    id: "seedance2_5",
    label: "Seedance 2.5",
    t2v: true,
    i2v: true,
    min: 4,
    max: 30,
    ratios: SEEDANCE_25,
    maxPrompt: 15000,
  },
  {
    id: "seedance2",
    label: "Seedance 2",
    t2v: true,
    i2v: true,
    min: 4,
    max: 15,
    ratios: [...SEEDANCE_HD, ...SEEDANCE_4K],
    maxPrompt: 3500,
  },
  {
    id: "seedance2_fast",
    label: "Seedance 2 Fast",
    t2v: true,
    i2v: true,
    min: 4,
    max: 15,
    ratios: SEEDANCE,
    maxPrompt: 3500,
  },
  {
    id: "seedance2_mini",
    label: "Seedance 2 Mini",
    t2v: true,
    i2v: true,
    min: 4,
    max: 15,
    ratios: SEEDANCE,
    maxPrompt: 3500,
  },
  {
    id: "hailuo3",
    label: "Hailuo 3",
    t2v: true,
    i2v: true,
    min: 5,
    max: 15,
    ratios: HAILUO_ASPECT,
    resolutions: ["768P", "2K"],
    maxPrompt: 6000,
  },
  {
    id: "h3_max",
    label: "Hailuo H3 Max",
    t2v: true,
    i2v: true,
    min: 5,
    max: 15,
    resolutions: ["480p", "768p"],
    i2vRatioFromImage: true,
    maxPrompt: 6000,
  },
  {
    id: "wan3",
    label: "Wan 3",
    t2v: true,
    i2v: true,
    min: 2,
    max: 30,
    ratios: WAN,
    i2vAutoRatio: true,
    maxPrompt: 20000,
  },
  {
    id: "wan3_prime",
    label: "Wan 3 Prime",
    t2v: true,
    i2v: true,
    min: 2,
    max: 30,
    ratios: WAN,
    i2vAutoRatio: true,
    maxPrompt: 20000,
  },
  {
    id: "grok_imagine_1_5",
    label: "Grok Imagine 1.5",
    t2v: true,
    i2v: true,
    min: 1,
    max: 15,
    ratios: GROK_ASPECT,
    resolutions: ["480p", "720p", "1080p"],
    i2vRatioFromImage: true,
    maxPrompt: 2500,
  },
  {
    id: "happyhorse_1_0",
    label: "HappyHorse 1.0",
    t2v: true,
    i2v: true,
    min: 3,
    max: 15,
    ratios: HAPPYHORSE,
    resolutions: ["720p", "1080p"],
    i2vRatioFromImage: true,
    maxPrompt: 2500,
  },
];

export const DEFAULT_RUNWAY_MODEL = "gen4.5";

export const RUNWAY_MODEL_IDS = new Set(RUNWAY_MODELS.map((m) => m.id));
