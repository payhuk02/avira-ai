/** Runway Dev video models (docs.dev.runwayml.com, API version 2024-11-06). Shared by admin UI and server. */
export type RunwayModel = {
  id: string;
  label: string;
  t2v: boolean; // text-to-video supported
  i2v: boolean; // image-to-video supported
  durations?: number[]; // fixed durations
  min?: number;
  max?: number;
  ratios?: string[]; // omitted = model decides
};

const SEEDANCE = ["992:432", "864:496", "752:560", "640:640", "560:752", "496:864", "1470:630", "1280:720", "1112:834", "960:960", "834:1112", "720:1280"];
const SEEDANCE_HD = [...SEEDANCE, "2206:946", "1920:1080", "1664:1248", "1440:1440", "1248:1664", "1080:1920"];
const WAN = ["832:480", "720:544", "624:624", "544:720", "480:832", "1280:720", "1104:832", "960:960", "832:1104", "720:1280", "1920:1080", "1648:1248", "1440:1440", "1248:1648", "1080:1920"];
const VEO = ["1280:720", "720:1280", "1080:1920", "1920:1080"];

export const RUNWAY_MODELS: RunwayModel[] = [
  { id: "gen4.5", label: "Runway Gen-4.5", t2v: true, i2v: true, min: 2, max: 10, ratios: ["1280:720", "720:1280", "1104:832", "960:960", "832:1104", "1584:672"] },
  { id: "gen4_turbo", label: "Runway Gen-4 Turbo (image → vidéo)", t2v: false, i2v: true, min: 2, max: 10, ratios: ["1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672"] },
  { id: "veo3.1", label: "Google Veo 3.1", t2v: true, i2v: true, durations: [4, 6, 8], ratios: VEO },
  { id: "veo3.1_fast", label: "Google Veo 3.1 Fast", t2v: true, i2v: true, durations: [4, 6, 8], ratios: VEO },
  { id: "gemini_omni_flash_1.1", label: "Gemini Omni Flash 1.1", t2v: true, i2v: true, min: 3, max: 10, ratios: ["640:360", "360:640", "1280:720", "720:1280", "1920:1080", "1080:1920", "3840:2160", "2160:3840"] },
  { id: "gemini_omni_flash", label: "Gemini Omni Flash", t2v: true, i2v: true, min: 3, max: 10, ratios: ["1280:720", "720:1280"] },
  { id: "seedance2_5", label: "Seedance 2.5", t2v: true, i2v: true, min: 4, max: 12, ratios: SEEDANCE_HD },
  { id: "seedance2", label: "Seedance 2", t2v: true, i2v: true, min: 4, max: 12, ratios: [...SEEDANCE_HD, "3840:2160", "2160:3840", "3840:3840"] },
  { id: "seedance2_fast", label: "Seedance 2 Fast", t2v: true, i2v: true, min: 4, max: 12, ratios: SEEDANCE },
  { id: "seedance2_mini", label: "Seedance 2 Mini", t2v: true, i2v: true, min: 4, max: 12, ratios: SEEDANCE },
  { id: "hailuo3", label: "Hailuo 3", t2v: true, i2v: true, min: 5, max: 15, ratios: ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"] },
  { id: "h3_max", label: "Hailuo H3 Max", t2v: true, i2v: true, min: 5, max: 15 },
  { id: "wan3", label: "Wan 3", t2v: true, i2v: true, min: 2, max: 30, ratios: WAN },
  { id: "wan3_prime", label: "Wan 3 Prime", t2v: true, i2v: true, min: 2, max: 30, ratios: WAN },
  { id: "grok_imagine_1_5", label: "Grok Imagine 1.5", t2v: true, i2v: true, min: 1, max: 15, ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"] },
  { id: "happyhorse_1_0", label: "HappyHorse 1.0", t2v: true, i2v: true, min: 3, max: 15, ratios: ["1280:720", "720:1280", "960:960", "1108:832", "832:1108", "1920:1080", "1080:1920", "1440:1440"] },
];

export const DEFAULT_RUNWAY_MODEL = "gen4.5";
