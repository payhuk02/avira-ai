import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GATEWAY, gatewayMessage } from "./gateway.server";
import { assertUsageAllowed } from "./limits.server";

export type ProjectRow = { id: string; name: string; color: string; created_at: string };

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("id, name, color, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as ProjectRow[];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({ name: data.name, user_id: context.userId })
      .select("id, name, color, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ProjectRow;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClipProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ clipId: z.string().uuid(), projectId: z.string().uuid().nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("clips")
      .update({ project_id: data.projectId })
      .eq("id", data.clipId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setClipSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ clipId: z.string().uuid(), enabled: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = data.enabled
      ? btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, (c) => (c === "+" ? "-" : c === "/" ? "_" : ""))
      : null;
    const { data: row, error } = await context.supabase
      .from("clips")
      .update({ share_token: token })
      .eq("id", data.clipId)
      .eq("status", "done")
      .select("share_token")
      .single();
    if (error) throw new Error("Seuls les clips terminés peuvent être partagés.");
    return { token: row.share_token as string | null };
  });

/** Public: resolves a share link. Only exposes the scene title, format and a short-lived video URL. */
export const getSharedClip = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ token: z.string().min(16).max(40).regex(/^[A-Za-z0-9_-]+$/) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: clip } = await supabaseAdmin
      .from("clips")
      .select("scene, format, duration, resolution, storage_path, created_at")
      .eq("share_token", data.token)
      .eq("status", "done")
      .maybeSingle();
    if (!clip?.storage_path) return null;
    const signed = await supabaseAdmin.storage.from("videos").createSignedUrl(clip.storage_path, 3600);
    if (!signed.data?.signedUrl) return null;
    return {
      scene: clip.scene,
      format: clip.format,
      duration: clip.duration,
      resolution: clip.resolution,
      created_at: clip.created_at,
      url: signed.data.signedUrl,
    };
  });

export const VOICES = [
  { id: "Kore", label: "Kore — ferme, posée" },
  { id: "Charon", label: "Charon — grave, narrative" },
  { id: "Aoede", label: "Aoede — légère, chaleureuse" },
  { id: "Puck", label: "Puck — enjouée" },
  { id: "Fenrir", label: "Fenrir — intense" },
] as const;

export const generateVoiceover = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        text: z.string().trim().min(2).max(3000),
        voice: z.enum(["Kore", "Charon", "Aoede", "Puck", "Fenrir"]),
        tone: z.string().trim().max(80).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let cfg;
    try {
      cfg = await assertUsageAllowed(context.userId, "voiceover");
    } catch (e) {
      return { error: (e as Error).message, audio: null };
    }
    if (!cfg.apiKey) return { error: "La voix off IA n'est pas configurée.", audio: null };
    const spoken = data.tone ? `Dis sur un ton ${data.tone} : ${data.text}` : data.text;
    const res = await fetch(`${GATEWAY}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-tts-preview",
        contents: [{ role: "user", parts: [{ text: spoken }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: data.voice } } },
        },
        stream_format: "audio",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      let msg: string | undefined;
      try {
        const p = JSON.parse(body) as { message?: string; error?: { message?: string } };
        msg = p.message ?? p.error?.message;
      } catch {}
      console.error("tts failed", res.status, body.slice(0, 200));
      return { error: gatewayMessage(res.status, msg), audio: null };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { error: null, audio: btoa(bin) };
  });
