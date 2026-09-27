import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { textModel } from "./gateway.server";
import { assertUsageAllowed, releaseUsage } from "./limits.server";

export type Scene = {
  number: number;
  title: string;
  duration: number;
  shot: string;
  action: string;
  camera: string;
  lighting: string;
  audio: string;
  prompt: string;
};

export type StoryboardRow = {
  id: string;
  idea: string;
  title: string;
  logline: string;
  format: string;
  scenes: Scene[];
  created_at: string;
};

const sceneSchema = z.object({
  number: z.number(),
  title: z.string(),
  duration: z.number(),
  shot: z.string(),
  action: z.string(),
  camera: z.string(),
  lighting: z.string(),
  audio: z.string(),
  prompt: z.string(),
});
const boardSchema = z.object({
  title: z.string(),
  logline: z.string(),
  scenes: z.array(sceneSchema),
});

const SYSTEM = `Tu es un réalisateur et storyboarder de films publicitaires et courts-métrages haut de gamme.
À partir de l'idée d'un créateur, écris un storyboard prêt à produire.
Règles :
- Entre 4 et 8 scènes, chacune durant entre 3 et 10 secondes (nombre entier).
- title, logline, et les champs title/shot/action/camera/lighting/audio de chaque scène sont en français, concis (1 à 2 phrases).
- shot : type de plan (plan large, plan moyen, gros plan…).
- prompt : en ANGLAIS, un prompt vidéo autonome et détaillé pour un générateur vidéo photoréaliste : sujet, apparence précise des personnages (âge, genre, teint de peau si pertinent ou demandé), décor, action, mouvement de caméra, lumière, ambiance sonore. Un seul plan continu, aucune coupe, aucun texte à l'écran. Chaque prompt doit se suffire à lui-même (répète les descriptions de personnages pour la cohérence).
- Respecte fidèlement toute indication de casting (origine, teint de peau) donnée par le créateur.`;

export const generateStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        idea: z.string().min(10).max(3000),
        format: z.string().max(10),
        tone: z.string().max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    let reserved = false;
    let cfg;
    try {
      cfg = await assertUsageAllowed(context.userId, "storyboard");
      reserved = true;
    } catch (e) {
      return { error: (e as Error).message, board: null };
    }
    const tm = await textModel(cfg);
    const result = streamText({
      model: tm.model,
      system: SYSTEM,
      prompt: `Idée : ${data.idea}\nFormat d'image : ${data.format}\nTon : ${data.tone}`,
      output: Output.object({ schema: boardSchema }),
      maxRetries: 0,
      providerOptions: tm.providerOptions as any,
    });

    let board: z.infer<typeof boardSchema>;
    try {
      board = await result.output;
    } catch (e) {
      await releaseUsage(context.userId, "storyboard");
      reserved = false;
      if (NoObjectGeneratedError.isInstance(e)) {
        return { error: "Le storyboard n'a pas pu être structuré. Reformulez votre idée.", board: null };
      }
      const status = (e as { statusCode?: number }).statusCode;
      console.error("storyboard failed", e);
      if (status === 402) return { error: "Crédits IA épuisés. Rechargez votre espace de travail.", board: null };
      if (status === 429) return { error: "Trop de demandes. Réessayez dans un instant.", board: null };
      return { error: "La génération du storyboard a échoué.", board: null };
    }

    const scenes = board.scenes.slice(0, 8).map((s, i) => ({
      ...s,
      number: i + 1,
      duration: Math.min(10, Math.max(3, Math.round(s.duration))),
    }));

    const { data: row, error } = await context.supabase
      .from("storyboards")
      .insert({
        user_id: context.userId,
        idea: data.idea,
        title: board.title,
        logline: board.logline,
        format: data.format,
        scenes,
      })
      .select()
      .single();
    if (error) {
      await releaseUsage(context.userId, "storyboard");
      reserved = false;
      throw new Error(error.message);
    }
    void reserved;
    return { error: null, board: row as unknown as StoryboardRow };
  });

export const listStoryboards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("storyboards")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as StoryboardRow[];
  });

export const deleteStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("storyboards").delete().eq("id", data.id);
    return { ok: true };
  });
