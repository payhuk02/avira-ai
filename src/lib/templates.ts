import type { AudioId, CameraId, FormatId, VisualStyleId } from "./studio";

export type Template = {
  id: string;
  label: string;
  hint: string;
  scene: string;
  format: FormatId;
  duration: number;
  camera: CameraId;
  visualStyle: VisualStyleId;
  audio: AudioId;
  voiceOver?: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "product",
    label: "Pub produit",
    hint: "16:9 · 10 s",
    scene:
      "Un flacon de parfum en verre fumé posé sur une dalle de marbre noir, gouttes d'eau sur le verre, reflets violets, fumée légère qui s'enroule autour du produit.",
    format: "16:9", duration: 10, camera: "push", visualStyle: "commercial", audio: "cinematic",
  },
  {
    id: "music",
    label: "Clip musical",
    hint: "9:16 · 15 s",
    scene:
      "Une chanteuse danse seule sur un toit de ville la nuit, néons violets en arrière-plan, cheveux au vent, énergie libre et intense.",
    format: "9:16", duration: 15, camera: "handheld", visualStyle: "social", audio: "energetic",
  },
  {
    id: "testimonial",
    label: "Témoignage",
    hint: "4:5 · 10 s",
    scene:
      "Un entrepreneur souriant parle face caméra dans son atelier lumineux, lumière douce de fenêtre, arrière-plan légèrement flou.",
    format: "4:5", duration: 10, camera: "fixed", visualStyle: "documentary", audio: "natural",
    voiceOver: "Depuis que nous avons commencé, nos clients ont doublé.",
  },
  {
    id: "travel",
    label: "Voyage",
    hint: "21:9 · 20 s",
    scene:
      "Une voyageuse marche sur une dune au lever du soleil, sable doré, longue ombre, vent qui soulève son foulard, immensité du désert.",
    format: "21:9", duration: 20, camera: "tracking", visualStyle: "cinema", audio: "cinematic",
  },
  {
    id: "food",
    label: "Food",
    hint: "1:1 · 5 s",
    scene:
      "Un chef dépose délicatement une sauce brillante sur une assiette gastronomique, vapeur visible, gros plan appétissant, lumière chaude.",
    format: "1:1", duration: 5, camera: "push", visualStyle: "commercial", audio: "natural",
  },
  {
    id: "sport",
    label: "Sport",
    hint: "9:16 · 10 s",
    scene:
      "Un sprinteur jaillit des starting-blocks sur une piste mouillée la nuit, projecteurs, gouttes en suspension, puissance musculaire.",
    format: "9:16", duration: 10, camera: "tracking", visualStyle: "commercial", audio: "energetic",
  },
];
