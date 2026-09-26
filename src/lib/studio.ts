export type FormatId = "16:9" | "9:16" | "1:1" | "21:9" | "4:5";
export type ResolutionId = "360p" | "720p" | "1080p" | "4k";
export type CameraId = "fixed" | "push" | "tracking" | "pan" | "handheld";
export type VisualStyleId = "cinema" | "commercial" | "documentary" | "social";
export type AudioId = "natural" | "cinematic" | "energetic" | "silent";

export const CAMERAS: { id: CameraId; label: string; prompt: string }[] = [
  { id: "fixed", label: "Plan fixe", prompt: "locked-off camera" },
  { id: "push", label: "Travelling avant", prompt: "slow cinematic push-in" },
  { id: "tracking", label: "Suivi", prompt: "smooth lateral tracking shot" },
  { id: "pan", label: "Panoramique", prompt: "slow controlled pan" },
  { id: "handheld", label: "Épaule", prompt: "subtle documentary handheld movement" },
];

export const VISUAL_STYLES: { id: VisualStyleId; label: string; prompt: string }[] = [
  { id: "cinema", label: "Cinéma", prompt: "premium cinematic feature-film color grading" },
  { id: "commercial", label: "Publicité", prompt: "polished luxury commercial finish" },
  { id: "documentary", label: "Documentaire", prompt: "authentic observational documentary realism" },
  { id: "social", label: "Réseaux", prompt: "dynamic premium social content pacing" },
];

export const AUDIO_MODES: { id: AudioId; label: string; prompt: string }[] = [
  { id: "natural", label: "Ambiance", prompt: "natural location ambience matching the scene. No music" },
  { id: "cinematic", label: "Cinématique", prompt: "subtle cinematic score with natural ambience" },
  { id: "energetic", label: "Énergique", prompt: "rhythmic modern music with crisp scene sound effects" },
  { id: "silent", label: "Sans musique", prompt: "room tone only. No music" },
];

export const RESOLUTIONS: { id: ResolutionId; label: string; detail: string }[] = [
  { id: "360p", label: "360p", detail: "Aperçu rapide" },
  { id: "720p", label: "HD", detail: "1280 × 720" },
  { id: "1080p", label: "Full HD", detail: "1920 × 1080" },
  { id: "4k", label: "4K", detail: "Ultra haute définition" },
];

export const FORMATS: {
  id: FormatId;
  label: string;
  base: "16:9" | "9:16";
  ratio: string;
  boxClass: string;
}[] = [
  { id: "16:9", label: "Cinéma", base: "16:9", ratio: "16 / 9", boxClass: "aspect-[16/9]" },
  { id: "9:16", label: "Vertical", base: "9:16", ratio: "9 / 16", boxClass: "aspect-[9/16]" },
  { id: "1:1", label: "Carré", base: "16:9", ratio: "1 / 1", boxClass: "aspect-square" },
  { id: "21:9", label: "Scope", base: "16:9", ratio: "21 / 9", boxClass: "aspect-[21/9]" },
  { id: "4:5", label: "Social", base: "9:16", ratio: "4 / 5", boxClass: "aspect-[4/5]" },
];

export const SKIN_TONES: { id: string; hex: string; label: string; en: string }[] = [
  { id: "tone-1", hex: "#f2d6bd", label: "Très claire", en: "very fair white skin, European features" },
  { id: "tone-2", hex: "#e0b48c", label: "Claire", en: "light olive skin, Mediterranean features" },
  { id: "tone-3", hex: "#b98156", label: "Médium", en: "medium brown skin, mixed-heritage features" },
  { id: "tone-4", hex: "#8a5a34", label: "Hâlée", en: "warm brown skin, Afro-descendant features" },
  { id: "tone-5", hex: "#5c3a22", label: "Foncée", en: "deep brown skin, West African features" },
  { id: "tone-6", hex: "#3a2416", label: "Très foncée", en: "very deep dark skin, African features" },
];

export const GENDERS: { id: string; label: string; en: string }[] = [
  { id: "f", label: "Femme", en: "woman" },
  { id: "m", label: "Homme", en: "man" },
  { id: "nb", label: "Non-binaire", en: "androgynous person" },
];

export const AGES: { id: string; label: string; en: string }[] = [
  { id: "20", label: "20–30", en: "in their twenties" },
  { id: "30", label: "30–40", en: "in their thirties" },
  { id: "40", label: "40–55", en: "in their late forties" },
];

export type Role = { toneId: string; genderId: string; ageId: string };

export type Clip = {
  id: string;
  title: string;
  prompt: string;
  format: FormatId;
  duration: number;
  status: "pending" | "done" | "failed";
  error?: string | null;
  createdAt: number;
};

function describeRole(role: Role, index: number) {
  const tone = SKIN_TONES.find((t) => t.id === role.toneId)!;
  const gender = GENDERS.find((g) => g.id === role.genderId)!;
  const age = AGES.find((a) => a.id === role.ageId)!;
  const who = index === 0 ? "The main character" : "The secondary character";
  return `${who} is a real, photoreal ${gender.en} ${age.en} with ${tone.en}.`;
}

export function buildPrompt(opts: {
  scene: string;
  roles: Role[];
  useRoles: boolean;
  light: number;
  grain: number;
  format: FormatId;
  camera: CameraId;
  visualStyle: VisualStyleId;
  audio: AudioId;
  voiceOver: string;
  hasReferenceImage: boolean;
  segment?: { index: number; count: number };
}) {
  const parts: string[] = [];
  parts.push(
    "Photorealistic live-action film footage, real human actors, natural skin texture and micro-expressions. Not animated, not illustrated, not CGI.",
  );
  parts.push(opts.scene.trim());
  if (opts.useRoles) parts.push(...opts.roles.map((r, i) => describeRole(r, i)));
  if (opts.hasReferenceImage) {
    parts.push("Use <IMAGE_REF_0> as the visual reference. Keep the subject's face, hair, clothing, colors and proportions unchanged.");
  }
  const camera = CAMERAS.find((item) => item.id === opts.camera)?.prompt ?? "locked-off camera";
  const style = VISUAL_STYLES.find((item) => item.id === opts.visualStyle)?.prompt ?? "premium cinematic feature-film color grading";
  parts.push(
    `Cinematography: ${camera}, ${style}, ${opts.light > 66 ? "bright golden raking light" : opts.light > 33 ? "soft natural daylight" : "low-key moody lighting"}, ${
      opts.grain > 66 ? "visible 35mm film grain" : opts.grain > 33 ? "fine film grain" : "clean digital sensor look"
    }, shallow depth of field, 24 fps, in a single continuous shot, no scene cuts.`,
  );
  if (opts.segment && opts.segment.count > 1) {
    parts.push(`This is shot ${opts.segment.index + 1} of ${opts.segment.count} in one coherent sequence. Preserve visual continuity while advancing the action.`);
  }
  const audio = AUDIO_MODES.find((item) => item.id === opts.audio)?.prompt ?? "natural location ambience matching the scene. No music";
  parts.push(`Audio: ${audio}. ${opts.voiceOver.trim() ? `A natural voice-over says: “${opts.voiceOver.trim()}”.` : "No dialogue."} No captions or on-screen text.`);
  parts.push("Consider micro-detail, expression and timing.");
  return parts.filter(Boolean).join(" ");
}

export function splitDuration(total: number) {
  const safeTotal = Math.min(60, Math.max(5, Math.round(total)));
  const count = Math.ceil(safeTotal / 10);
  const base = Math.floor(safeTotal / count);
  const extra = safeTotal % count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}
