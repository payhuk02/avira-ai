import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { textModel } from "./gateway.server";
import { assertUsageAllowed, releaseUsage } from "./limits.server";

function errorMessage(e: unknown) {
  const status = (e as { statusCode?: number }).statusCode;
  if (status === 402) return "Crédits IA épuisés. Rechargez votre espace de travail.";
  if (status === 429) return "Trop de demandes. Réessayez dans un instant.";
  if (status === 403) return "Accès au modèle refusé.";
  return "L'assistant IA n'a pas pu répondre.";
}

async function withAssistQuota<T extends { error: string | null }>(
  userId: string,
  run: () => Promise<T>,
): Promise<T> {
  let reserved = false;
  try {
    await assertUsageAllowed(userId, "assist");
    reserved = true;
  } catch (e) {
    return { error: (e as Error).message } as T;
  }
  try {
    const out = await run();
    if (out.error) await releaseUsage(userId, "assist");
    return out;
  } catch (e) {
    if (reserved) await releaseUsage(userId, "assist");
    throw e;
  }
}

export const enhancePrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ scene: z.string().trim().min(3).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    return withAssistQuota(context.userId, async () => {
      try {
        const { streamText } = await import("ai");
        const { getGatewayConfig } = await import("./gateway.server");
        const tm = await textModel(await getGatewayConfig());
        const result = streamText({
          model: tm.model,
          system:
            "Tu es directeur de la photographie. Réécris la description de scène de l'utilisateur en français pour un générateur vidéo photoréaliste : " +
            "sujet, décor, action continue, lumière, ambiance, texture. Un seul plan, pas de coupe, pas de texte à l'écran. " +
            "Conserve fidèlement toute indication de casting (origine, teint, genre, âge). 60 à 110 mots. Réponds uniquement par la description, sans guillemets.",
          prompt: data.scene,
          maxRetries: 0,
          providerOptions: tm.providerOptions as any,
        });
        const text = (await result.text).trim();
        if (!text) return { text: null, error: "Aucune proposition n'a été produite." };
        return { text: text.slice(0, 2000), error: null };
      } catch (e) {
        console.error("enhance failed", e);
        return { text: null, error: errorMessage(e) };
      }
    });
  });

export type Cue = { start: number; end: number; text: string };

const cuesSchema = z.object({ cues: z.array(z.object({ start: z.number(), end: z.number(), text: z.string() })) });

export const generateMusicBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ scene: z.string().trim().min(3).max(4000), duration: z.number().min(1).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    return withAssistQuota(context.userId, async () => {
      try {
        const { streamText } = await import("ai");
        const { getGatewayConfig } = await import("./gateway.server");
        const tm = await textModel(await getGatewayConfig());
        const result = streamText({
          model: tm.model,
          system:
            "Tu es compositeur et sound designer pour le cinéma. Pour la scène décrite, écris en français une direction musicale et sonore précise : " +
            "genre musical, tempo (BPM), instruments dominants, progression émotionnelle, ambiance sonore (bruitages, atmosphère), " +
            "et un conseil de mixage (volume de la musique par rapport aux sons d'ambiance). 80 à 130 mots, ton professionnel, sans titre ni guillemets.",
          prompt: `Scène de ${data.duration} secondes : ${data.scene}`,
          maxRetries: 0,
          providerOptions: tm.providerOptions as any,
        });
        const text = (await result.text).trim();
        if (!text) return { text: null, error: "Aucune proposition n'a été produite." };
        return { text: text.slice(0, 1500), error: null };
      } catch (e) {
        console.error("music brief failed", e);
        return { text: null, error: errorMessage(e) };
      }
    });
  });

export const generateSubtitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ scene: z.string().max(4000), duration: z.number().min(1).max(60), language: z.string().max(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    return withAssistQuota(context.userId, async () => {
      try {
        const { streamText, Output, NoObjectGeneratedError } = await import("ai");
        const { getGatewayConfig } = await import("./gateway.server");
        const tm = await textModel(await getGatewayConfig());
        const result = streamText({
          model: tm.model,
          system:
            `Tu écris des sous-titres courts pour une vidéo de ${data.duration} secondes, en ${data.language}. ` +
            "S'il y a un texte de voix off ou des répliques, découpe-les ; sinon écris une narration sobre et évocatrice de la scène. " +
            `Entre 2 et 8 sous-titres, chacun de 2 à 9 mots, start/end en secondes entre 0 et ${data.duration}, sans chevauchement.`,
          prompt: data.scene,
          output: Output.object({ schema: cuesSchema }),
          maxRetries: 0,
          providerOptions: tm.providerOptions as any,
        });
        let parsed: z.infer<typeof cuesSchema>;
        try {
          parsed = await result.output;
        } catch (e) {
          if (NoObjectGeneratedError.isInstance(e)) return { cues: null, error: "Les sous-titres n'ont pas pu être structurés." };
          throw e;
        }
        const cues = parsed.cues
          .slice(0, 12)
          .map((c) => ({
            start: Math.max(0, Math.min(data.duration, c.start)),
            end: Math.max(0, Math.min(data.duration, c.end)),
            text: c.text.slice(0, 120),
          }))
          .filter((c) => c.end > c.start && c.text.trim())
          .sort((a, b) => a.start - b.start);
        return { cues, error: null };
      } catch (e) {
        console.error("subtitles failed", e);
        return { cues: null, error: errorMessage(e) };
      }
    });
  });
