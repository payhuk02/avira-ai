import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runwayCreate, runwayFetch } from "./runway.server";
import { openrouterVideoCreate, openrouterVideoFetch } from "./openrouter.server";
import { GATEWAY, GOOGLE_API, gatewayMessage, getGatewayConfig } from "./gateway.server";
import { assertUsageAllowed } from "./limits.server";

export type ClipRow = {
  id: string;
  job_id: string;
  scene: string;
  prompt: string;
  format: string;
  resolution: string;
  duration: number;
  status: string;
  error: string | null;
  storage_path: string | null;
  music_brief: string | null;
  style_preset: string | null;
  project_id?: string | null;
  share_token?: string | null;
  created_at: string;
  url?: string | null;
};

export const STYLE_PRESETS = [
  { id: "anime", label: "Anime", suffix: "in a vibrant Japanese anime style, hand-drawn look, cel shading, expressive colors" },
  { id: "peinture", label: "Peinture à l'huile", suffix: "as a living oil painting, visible brushstrokes, rich impasto texture, classical lighting" },
  { id: "retro", label: "Rétro 16mm", suffix: "shot on vintage 16mm film, heavy grain, faded colors, 1970s home-movie aesthetic" },
  { id: "noir", label: "Film noir", suffix: "in high-contrast black and white film noir style, dramatic shadows, venetian blind lighting" },
  { id: "cyberpunk", label: "Cyberpunk", suffix: "neon-drenched cyberpunk style, rain reflections, magenta and cyan palette, futuristic haze" },
  { id: "aquarelle", label: "Aquarelle", suffix: "as a delicate watercolor painting in motion, soft washes, bleeding pigments, paper texture" },
] as const;

const clipInput = z.object({
  scene: z.string().min(3).max(2000),
  prompt: z.string().min(3).max(4000),
  format: z.string().max(10),
  aspect: z.enum(["16:9", "9:16"]),
  resolution: z.enum(["360p", "720p", "1080p", "4k"]),
  duration: z.number().min(5).max(10),
  stylePreset: z.string().max(30).optional(),
  projectId: z.string().uuid().nullable().optional(),
  referenceImage: z
    .object({
      /** ~2.5 Mo binaires en base64 — au-delà, risque DoS mémoire. */
      data: z.string().max(3_500_000),
      mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    })
    .optional(),
});


export const createClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => clipInput.parse(d))
  .handler(async ({ data, context }) => startClip(data, context));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function startClip(data: z.infer<typeof clipInput>, context: { supabase: any; userId: string }) {
  {
    let cfg;
    try {
      cfg = await assertUsageAllowed(context.userId, "clip");
    } catch (e) {
      return { error: (e as Error).message, clip: null };
    }
    const maxDur = Math.min(10, Math.max(5, cfg.maxDuration));
    if (data.duration > maxDur) {
      return { error: `Durée maximale autorisée : ${maxDur} s.`, clip: null };
    }
    const preset = STYLE_PRESETS.find((s) => s.id === data.stylePreset);
    const effectivePrompt = preset ? `${data.prompt}, ${preset.suffix}` : data.prompt;
    if (!cfg.allowedResolutions.includes(data.resolution))
      return { error: "Cette résolution est désactivée par l'administrateur.", clip: null };
    let jobId: string;
    if (cfg.openrouterKey && cfg.openrouterVideoModel) {
      const r = await openrouterVideoCreate(cfg.openrouterKeys, [cfg.openrouterVideoModel, ...cfg.openrouterVideoFallbacks], {
        prompt: effectivePrompt,
        aspect: data.aspect,
        resolution: data.resolution,
        duration: data.duration,
        image: data.referenceImage,
      });
      if ("error" in r) return { error: gatewayMessage(r.status, r.error), clip: null };
      jobId = `openrouter:${r.keyIndex}:${r.id}`;
    } else if (cfg.runwayKey) {
      const r = await runwayCreate(cfg.runwayKey, cfg.runwayVideoModel, {
        prompt: effectivePrompt,
        aspect: data.aspect,
        resolution: data.resolution,
        duration: data.duration,
        image: data.referenceImage,
      });
      if ("error" in r) return { error: gatewayMessage(r.status, r.error), clip: null };
      jobId = `runway:${r.id}`;
    } else if (cfg.googleKey) {
      // Direct Google Veo (Gemini API): durations 4/6/8 s, 720p/1080p
      const dur = data.duration <= 5 ? 4 : data.duration <= 7 ? 6 : 8;
      const resolution = data.resolution === "1080p" || data.resolution === "4k" ? "1080p" : "720p";
      const model = cfg.googleVideoModel.replace(/^google\//, "");
      const res = await fetch(`${GOOGLE_API}/models/${model}:predictLongRunning`, {
        method: "POST",
        headers: { "x-goog-api-key": cfg.googleKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [
            {
              prompt: effectivePrompt,
              ...(data.referenceImage
                ? { image: { bytesBase64Encoded: data.referenceImage.data, mimeType: data.referenceImage.mimeType } }
                : {}),
            },
          ],
          parameters: { aspectRatio: data.aspect, resolution, durationSeconds: dur },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        let msg: string | undefined;
        try { msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message; } catch {
          /* ignore invalid JSON */
        }
        console.error("google video create failed", res.status, body.slice(0, 300));
        return { error: gatewayMessage(res.status, msg), clip: null };
      }
      const op = (await res.json()) as { name: string };
      jobId = `google:${op.name}`;
    } else {
      if (!cfg.apiKey) return { error: "Aucune clé configurée pour la vidéo.", clip: null };
      const res = await fetch(`${GATEWAY}/videos`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: cfg.videoModel,
          input: data.referenceImage
            ? [
                { type: "text", text: effectivePrompt },
                { type: "image", data: data.referenceImage.data, mime_type: data.referenceImage.mimeType },
              ]
            : effectivePrompt,
          response_format: {
            type: "video",
            resolution: data.resolution,
            duration: `${Math.round(data.duration)}s`,
            aspect_ratio: data.aspect,
          },
          ...(data.referenceImage
            ? { generation_config: { video_config: { task: "image_to_video" } } }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        let safeMessage: string | undefined;
        try {
          const parsed = JSON.parse(body) as { message?: string; error?: { message?: string } };
          safeMessage = parsed.message ?? parsed.error?.message;
        } catch {
          /* ignore invalid JSON */
        }
        console.error("video create failed", res.status);
        return { error: gatewayMessage(res.status, safeMessage), clip: null };
      }
      jobId = ((await res.json()) as { id: string }).id;
    }
    const { data: row, error } = await context.supabase
      .from("clips")
      .insert({
        user_id: context.userId,
        job_id: jobId,
        scene: data.scene,
        prompt: effectivePrompt,
        format: data.format,
        resolution: data.resolution,
        duration: Math.round(data.duration),
        style_preset: preset?.id ?? null,
        project_id: data.projectId ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { error: null as string | null, clip: row as ClipRow };
  }
}

async function fetchJobVideo(jobId: string): Promise<
  { state: "pending" } | { state: "failed"; message: string } | { state: "done"; bytes: ArrayBuffer }
> {
  const cfg = await getGatewayConfig();
  if (jobId.startsWith("openrouter:")) {
    const rest = jobId.slice(11);
    const m = rest.match(/^(\d+):(.+)$/);
    const key = m ? cfg.openrouterKeys[Number(m[1])] : cfg.openrouterKey;
    if (!key) return { state: "failed", message: "Clé OpenRouter retirée avant la fin du rendu." };
    return openrouterVideoFetch(key, m ? m[2]! : rest);
  }
  if (jobId.startsWith("runway:")) {
    if (!cfg.runwayKey) return { state: "failed", message: "Clé Runway retirée avant la fin du rendu." };
    return runwayFetch(cfg.runwayKey, jobId.slice(7));
  }
  if (jobId.startsWith("google:")) {
    const name = jobId.slice(7);
    if (!cfg.googleKey) return { state: "failed", message: "Clé Google retirée avant la fin du rendu." };
    const res = await fetch(`${GOOGLE_API}/${name}`, { headers: { "x-goog-api-key": cfg.googleKey } });
    if (!res.ok) return { state: "pending" };
    const op = (await res.json()) as {
      done?: boolean;
      error?: { message?: string };
      response?: { generateVideoResponse?: { generatedSamples?: { video?: { uri?: string } }[]; raiMediaFilteredReasons?: string[] } };
    };
    if (!op.done) return { state: "pending" };
    if (op.error) return { state: "failed", message: op.error.message ?? "Rendu refusé." };
    const g = op.response?.generateVideoResponse;
    const uri = g?.generatedSamples?.[0]?.video?.uri;
    if (!uri) return { state: "failed", message: g?.raiMediaFilteredReasons?.[0] ?? "Rendu refusé." };
    const content = await fetch(uri, { headers: { "x-goog-api-key": cfg.googleKey }, redirect: "follow" });
    if (!content.ok) return { state: "pending" };
    return { state: "done", bytes: await content.arrayBuffer() };
  }
  const res = await fetch(`${GATEWAY}/videos/${encodeURIComponent(jobId)}`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!res.ok) return { state: "pending" };
  const job = (await res.json()) as { status: string; error?: { message?: string } };
  if (job.status === "failed") return { state: "failed", message: job.error?.message ?? "Rendu refusé." };
  if (job.status !== "completed") return { state: "pending" };
  const content = await fetch(`${GATEWAY}/videos/${encodeURIComponent(jobId)}/content`, {
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
  });
  if (!content.ok) return { state: "pending" };
  return { state: "done", bytes: await content.arrayBuffer() };
}

export const refreshClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: clip, error } = await sb.from("clips").select("*").eq("id", data.id).single();
    if (error || !clip) throw new Error("Clip introuvable.");
    if (clip.status !== "pending") return clip as ClipRow;

    const job = await fetchJobVideo(clip.job_id);
    if (job.state === "failed") {
      const { data: upd } = await sb
        .from("clips")
        .update({ status: "failed", error: job.message })
        .eq("id", clip.id)
        .select()
        .single();
      return upd as ClipRow;
    }
    if (job.state !== "done") return clip as ClipRow;
    const bytes = job.bytes;
    const path = `${context.userId}/${clip.id}.mp4`;
    const up = await sb.storage
      .from("videos")
      .upload(path, bytes, { contentType: "video/mp4", upsert: true });
    if (up.error) {
      console.error("upload failed", up.error);
      return clip as ClipRow;
    }
    const { data: upd } = await sb
      .from("clips")
      .update({ status: "done", storage_path: path })
      .eq("id", clip.id)
      .select()
      .single();
    const signed = await sb.storage.from("videos").createSignedUrl(path, 3600);
    return { ...(upd as ClipRow), url: signed.data?.signedUrl ?? null };
  });

export const listClips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data, error } = await sb
      .from("clips")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as ClipRow[];
    const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p);
    const urls = new Map<string, string>();
    if (paths.length) {
      const { data: signed } = await sb.storage.from("videos").createSignedUrls(paths, 3600);
      signed?.forEach((s) => s.path && s.signedUrl && urls.set(s.path, s.signedUrl));
    }
    return rows.map((r) => ({ ...r, url: r.storage_path ? (urls.get(r.storage_path) ?? null) : null }));
  });

export const deleteClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: clip } = await sb.from("clips").select("storage_path").eq("id", data.id).single();
    if (clip?.storage_path) await sb.storage.from("videos").remove([clip.storage_path]);
    await sb.from("clips").delete().eq("id", data.id);
    return { ok: true };
  });

export const getClipDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: clip, error } = await context.supabase
      .from("clips")
      .select("storage_path, format, resolution")
      .eq("id", data.id)
      .single();
    if (error || !clip?.storage_path) throw new Error("Le rendu final n'est pas encore disponible.");
    const filename = `avira-${data.id}-${clip.format}-${clip.resolution}.mp4`;
    const signed = await context.supabase.storage
      .from("videos")
      .createSignedUrl(clip.storage_path, 300, { download: filename });
    if (signed.error || !signed.data?.signedUrl) throw new Error("Le téléchargement est indisponible.");
    return { url: signed.data.signedUrl, filename };
  });

export const restyleClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), stylePreset: z.string().max(30) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: clip, error } = await context.supabase
      .from("clips")
      .select("scene, prompt, format, resolution, duration, project_id")
      .eq("id", data.id)
      .single();
    if (error || !clip) throw new Error("Clip introuvable.");
    const aspect = clip.format === "9:16" ? "9:16" : ("16:9" as const);
    return startClip(
      {
        scene: `${clip.scene} (version ${data.stylePreset})`.slice(0, 2000),
        prompt: clip.prompt.slice(0, 3900),
        format: clip.format,
        aspect,
        resolution: (["360p", "720p", "1080p", "4k"].includes(clip.resolution) ? clip.resolution : "720p") as
          "360p" | "720p" | "1080p" | "4k",
        duration: Math.min(10, Math.max(5, clip.duration)),
        stylePreset: data.stylePreset,
        projectId: clip.project_id,
      },
      context,
    );
  });

export const saveMusicBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), brief: z.string().trim().min(3).max(1500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clips")
      .update({ music_brief: data.brief })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type MyStats = {
  total: number;
  done: number;
  failed: number;
  pending: number;
  successRate: number;
  totalSeconds: number;
  estimatedCost: number;
  byFormat: { format: string; count: number }[];
  byDay: { day: string; count: number }[];
  topStyles: { style: string; count: number }[];
};

export const myStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyStats> => {
    const { data, error } = await context.supabase
      .from("clips")
      .select("status, duration, format, style_preset, created_at")
      .order("created_at", { ascending: true })
      .limit(1000);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const done = rows.filter((r) => r.status === "done");
    const failed = rows.filter((r) => r.status === "failed");
    const pending = rows.filter((r) => r.status === "pending");
    const finished = done.length + failed.length;
    const totalSeconds = done.reduce((s, r) => s + (r.duration ?? 0), 0);
    const byFormatMap = new Map<string, number>();
    const byDayMap = new Map<string, number>();
    const styleMap = new Map<string, number>();
    for (const r of rows) {
      byFormatMap.set(r.format, (byFormatMap.get(r.format) ?? 0) + 1);
      const day = String(r.created_at).slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
      if (r.style_preset) styleMap.set(r.style_preset, (styleMap.get(r.style_preset) ?? 0) + 1);
    }
    return {
      total: rows.length,
      done: done.length,
      failed: failed.length,
      pending: pending.length,
      successRate: finished ? Math.round((done.length / finished) * 100) : 0,
      totalSeconds,
      estimatedCost: Math.round(totalSeconds * 0.1 * 100) / 100,
      byFormat: [...byFormatMap.entries()].map(([format, count]) => ({ format, count })),
      byDay: [...byDayMap.entries()].slice(-14).map(([day, count]) => ({ day, count })),
      topStyles: [...styleMap.entries()]
        .map(([style, count]) => ({ style, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
    };
  });
