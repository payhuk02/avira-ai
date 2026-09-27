import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { RUNWAY_MODEL_IDS } from "./runway-models";
import { KLING_MODEL_IDS } from "./kling-models";
import { OPENAI_MODEL_IDS } from "./openai-models";
import { BRAND_SLUG } from "./brand";

async function audit(
  admin: any,
  context: { userId: string; claims?: any },
  category: "api_key" | "user" | "settings" | "content",
  action: string,
  target: string,
  details: Record<string, unknown> = {},
) {
  await admin.from("admin_audit_log").insert({
    actor_id: context.userId,
    actor_email: context.claims?.email ?? "",
    category,
    action,
    target,
    details,
  });
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Accès réservé aux administrateurs.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export const checkAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: !!data };
  });

async function listAllUsers(admin: any) {
  const users: any[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users;
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const users = await listAllUsers(admin);
    const { data: clips } = await admin.from("clips").select("status, created_at, duration");
    const { count: boards } = await admin.from("storyboards").select("id", { count: "exact", head: true });
    const all = clips ?? [];
    const days: { day: string; clips: number; users: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push({
        day: d,
        clips: all.filter((c: any) => c.created_at.startsWith(d)).length,
        users: users.filter((u) => u.created_at?.startsWith(d)).length,
      });
    }
    return {
      users: users.length,
      clips: all.length,
      done: all.filter((c: any) => c.status === "done").length,
      pending: all.filter((c: any) => c.status === "pending").length,
      failed: all.filter((c: any) => c.status === "failed").length,
      seconds: all.filter((c: any) => c.status === "done").reduce((s: number, c: any) => s + c.duration, 0),
      storyboards: boards ?? 0,
      days,
    };
  });

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const users = await listAllUsers(admin);
    const { data: clips } = await admin.from("clips").select("user_id");
    const { data: roles } = await admin.from("user_roles").select("user_id, role").eq("role", "admin");
    const counts: Record<string, number> = {};
    for (const c of clips ?? []) counts[c.user_id] = (counts[c.user_id] ?? 0) + 1;
    const admins = new Set((roles ?? []).map((r: any) => r.user_id));
    return users.map((u) => ({
      id: u.id as string,
      email: (u.email ?? "") as string,
      created_at: u.created_at as string,
      last_sign_in_at: (u.last_sign_in_at ?? null) as string | null,
      banned: !!u.banned_until && new Date(u.banned_until) > new Date(),
      clips: counts[u.id] ?? 0,
      isAdmin: admins.has(u.id),
    }));
  });

export const adminUserAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        userId: z.string().uuid(),
        action: z.enum(["ban", "unban", "delete", "grantAdmin", "revokeAdmin"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (data.userId === context.userId && data.action !== "grantAdmin")
      throw new Error("Vous ne pouvez pas appliquer cette action à votre propre compte.");
    const { data: target } = await admin.auth.admin.getUserById(data.userId);
    const targetEmail = target?.user?.email ?? "";
    if (data.action === "ban" || data.action === "unban") {
      const { error } = await admin.auth.admin.updateUserById(data.userId, {
        ban_duration: data.action === "ban" ? "876000h" : "none",
      });
      if (error) throw new Error(error.message);
    } else if (data.action === "delete") {
      const { data: files } = await admin.storage.from("videos").list(data.userId, { limit: 1000 });
      if (files?.length)
        await admin.storage.from("videos").remove(files.map((f: any) => `${data.userId}/${f.name}`));
      await admin.from("clips").delete().eq("user_id", data.userId);
      await admin.from("storyboards").delete().eq("user_id", data.userId);
      await admin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await admin.auth.admin.deleteUser(data.userId);
      if (error) throw new Error(error.message);
    } else if (data.action === "grantAdmin") {
      await admin.from("user_roles").upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await admin.from("user_roles").delete().eq("user_id", data.userId).eq("role", "admin");
    }
    await audit(admin, context, "user", data.action, targetEmail || data.userId, { userId: data.userId });
    return { ok: true };
  });

export const adminListClips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const users = await listAllUsers(admin);
    const emails = Object.fromEntries(users.map((u) => [u.id, u.email ?? ""]));
    const { data } = await admin.from("clips").select("*").order("created_at", { ascending: false }).limit(500);
    return (data ?? []).map((c: any) => ({ ...c, email: emails[c.user_id] ?? "—" })) as Array<{
      id: string; user_id: string; email: string; scene: string; format: string; resolution: string;
      duration: number; status: string; error: string | null; storage_path: string | null; created_at: string;
    }>;
  });

export const adminClipUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), download: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: clip } = await admin.from("clips").select("storage_path").eq("id", data.id).single();
    if (!clip?.storage_path) throw new Error("Aucun fichier pour ce clip.");
    const { data: s, error } = await admin.storage
      .from("videos")
      .createSignedUrl(clip.storage_path, 600, data.download ? { download: `${BRAND_SLUG}-${data.id}.mp4` } : undefined);
    if (error) throw new Error(error.message);
    return { url: s.signedUrl };
  });

export const adminDeleteClip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: clip } = await admin.from("clips").select("storage_path").eq("id", data.id).single();
    if (clip?.storage_path) await admin.storage.from("videos").remove([clip.storage_path]);
    await admin.from("clips").delete().eq("id", data.id);
    await audit(admin, context, "content", "delete_clip", data.id);
    return { ok: true };
  });

export const adminListStoryboards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const users = await listAllUsers(admin);
    const emails = Object.fromEntries(users.map((u) => [u.id, u.email ?? ""]));
    const { data } = await admin.from("storyboards").select("*").order("created_at", { ascending: false }).limit(500);
    return (data ?? []).map((b: any) => ({
      id: b.id as string, email: (emails[b.user_id] ?? "—") as string, title: b.title as string,
      logline: b.logline as string, idea: b.idea as string, format: b.format as string,
      created_at: b.created_at as string,
      scenes: (b.scenes ?? []) as Array<{ duration?: number; shot?: string; action?: string; prompt?: string }>,
    }));
  });

export const adminDeleteStoryboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    await admin.from("storyboards").delete().eq("id", data.id);
    await audit(admin, context, "content", "delete_storyboard", data.id);
    return { ok: true };
  });

/* ---------- API keys ---------- */

const KEYS = [
  { name: "LOVABLE_API_KEY", label: "Passerelle IA Lovable", usage: "Utilisée par défaut si aucune clé directe n'est définie" },
  { name: "OPENAI_API_KEY", label: "OpenAI (GPT)", usage: "Storyboards et analyses IA — prioritaire sur OpenRouter / passerelle Lovable" },
  { name: "OPENROUTER_API_KEY", label: "OpenRouter", usage: "Texte (si pas de clé OpenAI) + vidéo — 2e dans la cascade vidéo ; pool de relais + modèles de secours" },
  { name: "RUNWAY_API_KEY", label: "Runway Dev", usage: "Génération vidéo — 3e dans la cascade" },
  { name: "KLING_API_KEY", label: "Kling AI", usage: "Génération vidéo — 4e dans la cascade (api-singapore.klingai.com)" },
  { name: "GOOGLE_API_KEY", label: "Google (Gemini / Veo)", usage: "Vidéo Veo — 1er dans la cascade providers" },
] as const;
type KeyName = (typeof KEYS)[number]["name"];

function mask(v: string) {
  return v.length <= 8 ? "••••" : `${v.slice(0, 4)}…${v.slice(-4)}`;
}

export const adminListKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data } = await admin.from("app_config").select("key, value, updated_at").eq("is_secret", true);
    const map = Object.fromEntries((data ?? []).map((r: any) => [r.key, r]));
    return KEYS.map((k) => {
      const override = map[k.name];
      const env = process.env[k.name];
      return {
        ...k,
        source: override ? ("custom" as const) : env ? ("default" as const) : ("missing" as const),
        masked: override ? mask(override.value) : env ? mask(env) : null,
        updated_at: (override?.updated_at ?? null) as string | null,
      };
    });
  });

const keyEnum = z.enum(["LOVABLE_API_KEY", "OPENAI_API_KEY", "OPENROUTER_API_KEY", "RUNWAY_API_KEY", "KLING_API_KEY", "GOOGLE_API_KEY"]);

export const adminSetKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ name: keyEnum, value: z.string().trim().max(500).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    if (!data.value) {
      await admin.from("app_config").delete().eq("key", data.name);
    } else {
      if (data.value.length < 10) throw new Error("Clé trop courte.");
      const { error } = await admin
        .from("app_config")
        .upsert({ key: data.name, value: data.value, is_secret: true, updated_at: new Date().toISOString() });
      if (error) throw new Error(error.message);
    }
    await audit(admin, context, "api_key", data.value ? "update_key" : "reset_key", data.name, {
      suffix: data.value ? data.value.slice(-4) : null,
    });
    return { ok: true };
  });

export const adminTestKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: keyEnum, value: z.string().trim().max(500).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { GATEWAY, GOOGLE_API, getGatewayConfig } = await import("./gateway.server");
    const cfg = await getGatewayConfig().catch(() => null);
    const name = data.name as KeyName;
    const stored =
      name === "OPENAI_API_KEY"
        ? cfg?.openaiKey
        : name === "GOOGLE_API_KEY"
          ? cfg?.googleKey
          : name === "RUNWAY_API_KEY"
            ? cfg?.runwayKey
            : name === "KLING_API_KEY"
              ? cfg?.klingKey
              : name === "OPENROUTER_API_KEY"
                ? cfg?.openrouterKey
                : cfg?.apiKey;
    const key = data.value || stored;
    if (!key) return { ok: false, status: 0 };
    if (name === "KLING_API_KEY") {
      const { klingTestKey } = await import("./kling.server");
      return klingTestKey(key);
    }
    const res =
      name === "OPENAI_API_KEY"
        ? await fetch("https://api.openai.com/v1/models", { headers: { Authorization: `Bearer ${key}` } })
        : name === "OPENROUTER_API_KEY"
          ? await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${key}` } })
        : name === "RUNWAY_API_KEY"
          ? await fetch("https://api.dev.runwayml.com/v1/organization", { headers: { Authorization: `Bearer ${key}`, "X-Runway-Version": "2024-11-06" } })
        : name === "GOOGLE_API_KEY"
          ? await fetch(`${GOOGLE_API}/models`, { headers: { "x-goog-api-key": key } })
          : await fetch(`${GATEWAY}/models`, { headers: { Authorization: `Bearer ${key}` } });
    return { ok: res.ok, status: res.status };
  });

/* ---------- OpenRouter key pool (max 100) ---------- */

export const adminGetOpenRouterPool = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    const { data } = await admin.from("app_config").select("key, value").in("key", ["OPENROUTER_API_KEYS", "openrouter_fallback_models", "openrouter_video_fallbacks"]);
    const m = Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value as string]));
    const keys: string[] = String(m["OPENROUTER_API_KEYS"] ?? "").split(/\s+/).filter(Boolean);
    return {
      keys: keys.map((k: string, i: number) => ({ index: i, masked: mask(k) })),
      fallbackModels: m["openrouter_fallback_models"] ?? "",
      videoFallbacks: m["openrouter_video_fallbacks"] ?? "",
    };
  });

export const adminSaveOpenRouterPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      add: z.array(z.string().trim().min(10).max(500)).max(100),
      remove: z.array(z.number().int().min(0)).max(100),
      fallbackModels: z.string().max(4000),
      videoFallbacks: z.string().max(4000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const { data: row } = await admin.from("app_config").select("value").eq("key", "OPENROUTER_API_KEYS").maybeSingle();
    const current = ((row?.value as string | undefined) ?? "").split(/\s+/).filter(Boolean);
    const kept = current.filter((_, i) => !data.remove.includes(i));
    const next = [...new Set([...kept, ...data.add])];
    if (next.length > 100) throw new Error("Maximum 100 clés OpenRouter.");
    const now = new Date().toISOString();
    if (next.length) {
      const { error } = await admin.from("app_config").upsert({ key: "OPENROUTER_API_KEYS", value: next.join("\n"), is_secret: true, updated_at: now });
      if (error) throw new Error(error.message);
    } else await admin.from("app_config").delete().eq("key", "OPENROUTER_API_KEYS");
    const norm = (v: string) => v.split(/[\s,]+/).filter(Boolean).join(",");
    const { error } = await admin.from("app_config").upsert([
      { key: "openrouter_fallback_models", value: norm(data.fallbackModels), is_secret: false, updated_at: now },
      { key: "openrouter_video_fallbacks", value: norm(data.videoFallbacks), is_secret: false, updated_at: now },
    ]);
    if (error) throw new Error(error.message);
    await audit(admin, context, "api_key", "update_openrouter_pool", "OPENROUTER_API_KEYS", { count: next.length, added: data.add.length, removed: data.remove.length });
    return { count: next.length };
  });

export const adminTestOpenRouterPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getGatewayConfig } = await import("./gateway.server");
    const cfg = await getGatewayConfig().catch(() => null);
    const keys = cfg?.openrouterKeys ?? [];
    return Promise.all(
      keys.map(async (k) => {
        const r = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${k}` } });
        const d = r.ok ? ((await r.json()) as { data?: { limit_remaining?: number | null; usage?: number } }).data : undefined;
        return { masked: mask(k), ok: r.ok, status: r.status, remaining: d?.limit_remaining ?? null, usage: d?.usage ?? null };
      }),
    );
  });

/* ---------- OpenRouter catalogue ---------- */

export const adminListOpenRouterModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) return [] as { id: string; name: string; context: number; prompt: string }[];
    const j = (await res.json()) as { data: { id: string; name: string; context_length?: number; pricing?: { prompt?: string }; architecture?: { output_modalities?: string[] } }[] };
    return j.data
      .filter((m) => !m.architecture?.output_modalities || m.architecture.output_modalities.includes("text"))
      .map((m) => ({ id: m.id, name: m.name, context: m.context_length ?? 0, prompt: m.pricing?.prompt ?? "0" }))
      .sort((a, b) => a.id.localeCompare(b.id));
  });

export const adminListOpenRouterVideoModels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { listOpenRouterVideoModels } = await import("./openrouter.server");
    return (await listOpenRouterVideoModels())
      .filter((m) => m.supported_durations?.length)
      .map((m) => ({
        id: m.id,
        durations: m.supported_durations ?? [],
        resolutions: m.supported_resolutions ?? [],
      }));
  });

/* ---------- Settings ---------- */

export const adminGetSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { getGatewayConfig } = await import("./gateway.server");
    const c = await getGatewayConfig();
    return {
      videoModel: c.videoModel,
      textModel: c.textModel,
      openaiModel: c.openaiModel,
      openaiConfigured: !!c.openaiKey,
      googleVideoModel: c.googleVideoModel,
      runwayVideoModel: c.runwayVideoModel,
      runwayConfigured: !!c.runwayKey,
      klingVideoModel: c.klingVideoModel,
      klingConfigured: !!c.klingKey,
      openrouterModel: c.openrouterModel,
      openrouterConfigured: !!c.openrouterKey,
      openrouterVideoModel: c.openrouterVideoModel,
      maxDuration: c.maxDuration,
      generationEnabled: c.generationEnabled,
      allowedResolutions: c.allowedResolutions,
      ...(await getBudgetConfig()),
    };
  });

export const adminSaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        videoModel: z.string().trim().min(3).max(120),
        textModel: z.string().trim().min(3).max(120),
        openaiModel: z
          .string()
          .trim()
          .min(3)
          .max(120)
          .refine((id) => OPENAI_MODEL_IDS.has(id.replace(/^openai\//, "")), "Modèle OpenAI inconnu"),
        googleVideoModel: z.string().trim().min(3).max(120),
        runwayVideoModel: z
          .string()
          .trim()
          .min(2)
          .max(60)
          .refine((id) => RUNWAY_MODEL_IDS.has(id), "Modèle Runway inconnu"),
        klingVideoModel: z
          .string()
          .trim()
          .min(2)
          .max(60)
          .refine((id) => KLING_MODEL_IDS.has(id), "Modèle Kling inconnu"),
        openrouterModel: z.string().trim().min(2).max(200),
        openrouterVideoModel: z.string().trim().max(200),
        maxDuration: z.number().int().min(5).max(60),
        generationEnabled: z.boolean(),
        allowedResolutions: z.array(z.enum(["360p", "720p", "1080p", "4k"])).min(1),
        monthlyBudget: z.number().min(0).max(1_000_000),
        alertThreshold: z.number().int().min(1).max(100),
        costPerVideoSecond: z.number().min(0).max(1000),
        costPerStoryboard: z.number().min(0).max(1000),
        dailyClipLimit: z.number().int().min(0).max(1000),
        dailyStoryboardLimit: z.number().int().min(0).max(1000),
        dailyAssistLimit: z.number().int().min(0).max(5000),
        dailyVoiceoverLimit: z.number().int().min(0).max(1000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const now = new Date().toISOString();
    const rows = [
      { key: "video_model", value: data.videoModel },
      { key: "text_model", value: data.textModel },
      { key: "openai_model", value: data.openaiModel.replace(/^openai\//, "") },
      { key: "google_video_model", value: data.googleVideoModel },
      { key: "runway_video_model", value: data.runwayVideoModel },
      { key: "kling_video_model", value: data.klingVideoModel },
      { key: "openrouter_model", value: data.openrouterModel },
      { key: "openrouter_video_model", value: data.openrouterVideoModel },
      { key: "max_duration", value: String(data.maxDuration) },
      { key: "generation_enabled", value: String(data.generationEnabled) },
      { key: "allowed_resolutions", value: data.allowedResolutions.join(",") },
      { key: "monthly_budget", value: String(data.monthlyBudget) },
      { key: "alert_threshold", value: String(data.alertThreshold) },
      { key: "cost_per_video_second", value: String(data.costPerVideoSecond) },
      { key: "cost_per_storyboard", value: String(data.costPerStoryboard) },
      { key: "daily_clip_limit", value: String(data.dailyClipLimit) },
      { key: "daily_storyboard_limit", value: String(data.dailyStoryboardLimit) },
      { key: "daily_assist_limit", value: String(data.dailyAssistLimit) },
      { key: "daily_voiceover_limit", value: String(data.dailyVoiceoverLimit) },
    ].map((r) => ({ ...r, is_secret: false, updated_at: now }));
    const { error } = await admin.from("app_config").upsert(rows);
    if (error) throw new Error(error.message);
    await audit(admin, context, "settings", "update_settings", "platform", data);
    return { ok: true };
  });

/* Public (signed-in) limits used by the studio */
export const getStudioLimits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getPublicStudioLimits } = await import("./limits.server");
    return getPublicStudioLimits();
  });

/* ---------- Budget, usage & costs ---------- */

async function getBudgetConfig() {
  const { getUsageLimits } = await import("./limits.server");
  const l = await getUsageLimits();
  return {
    monthlyBudget: l.monthlyBudget,
    alertThreshold: l.alertThreshold,
    costPerVideoSecond: l.costPerVideoSecond,
    costPerStoryboard: l.costPerStoryboard,
    dailyClipLimit: l.dailyClipLimit,
    dailyStoryboardLimit: l.dailyStoryboardLimit,
    dailyAssistLimit: l.dailyAssistLimit,
    dailyVoiceoverLimit: l.dailyVoiceoverLimit,
  };
}

async function computeUsage(admin: any) {
  const { getGatewayConfig } = await import("./gateway.server");
  const cfg = await getGatewayConfig();
  const budget = await getBudgetConfig();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const { data: clips } = await admin
    .from("clips").select("status, duration, resolution, format, error, created_at, user_id").gte("created_at", since);
  const { data: boards } = await admin.from("storyboards").select("created_at, user_id").gte("created_at", since);
  const c = (clips ?? []) as any[];
  const b = (boards ?? []) as any[];
  const provider = (m: string) => m.split("/")[0] ?? m;
  const videoCost = (x: any) => (x.status === "failed" ? 0 : x.duration * budget.costPerVideoSecond);
  const days: { day: string; clips: number; failed: number; storyboards: number; cost: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const dc = c.filter((x) => x.created_at.startsWith(d));
    const db = b.filter((x) => x.created_at.startsWith(d));
    days.push({
      day: d,
      clips: dc.length,
      failed: dc.filter((x) => x.status === "failed").length,
      storyboards: db.length,
      cost: dc.reduce((s, x) => s + videoCost(x), 0) + db.length * budget.costPerStoryboard,
    });
  }
  const errors: Record<string, number> = {};
  for (const x of c.filter((x) => x.status === "failed")) {
    const k = (x.error ?? "Inconnue").slice(0, 120);
    errors[k] = (errors[k] ?? 0) + 1;
  }
  const byRes: Record<string, number> = {};
  for (const x of c) byRes[x.resolution] = (byRes[x.resolution] ?? 0) + 1;
  const monthClips = c.filter((x) => x.created_at >= monthStart);
  const monthBoards = b.filter((x) => x.created_at >= monthStart);
  const providers = [
    {
      provider: provider(cfg.videoModel), model: cfg.videoModel, kind: "Vidéo",
      requests: c.length, failed: c.filter((x) => x.status === "failed").length,
      cost30d: c.reduce((s, x) => s + videoCost(x), 0),
      costMonth: monthClips.reduce((s, x) => s + videoCost(x), 0),
    },
    {
      provider: provider(cfg.textModel), model: cfg.textModel, kind: "Storyboard",
      requests: b.length, failed: 0,
      cost30d: b.length * budget.costPerStoryboard,
      costMonth: monthBoards.length * budget.costPerStoryboard,
    },
  ];
  const monthCost = providers.reduce((s, p) => s + p.costMonth, 0);
  const pct = budget.monthlyBudget > 0 ? (monthCost / budget.monthlyBudget) * 100 : 0;
  return {
    budget,
    providers,
    days,
    topErrors: Object.entries(errors).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([message, count]) => ({ message, count })),
    byResolution: byRes,
    activeUsers30d: new Set([...c, ...b].map((x) => x.user_id)).size,
    monthCost,
    budgetPct: pct,
    alert: budget.monthlyBudget > 0 && pct >= budget.alertThreshold ? (pct >= 100 ? "exceeded" : "warning") : null,
  } as const;
}

export const adminUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await assertAdmin(context);
    return computeUsage(admin);
  });

/* ---------- Audit log ---------- */

export const adminAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ q: z.string().max(120).optional(), category: z.string().max(20).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    let query = admin.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(300);
    if (data.category && data.category !== "all") query = query.eq("category", data.category);
    if (data.q) {
      const q = data.q.replace(/[%,()]/g, "");
      query = query.or(`actor_email.ilike.%${q}%,action.ilike.%${q}%,target.ilike.%${q}%`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({ ...r, details: JSON.stringify(r.details ?? {}) })) as Array<{
      id: string; actor_email: string; category: string; action: string; target: string;
      details: string; created_at: string;
    }>;
  });

/* ---------- AI insights ---------- */

export const adminAskInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().trim().min(3).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await assertAdmin(context);
    const usage = await computeUsage(admin);
    const { count: users } = await admin.from("user_roles").select("id", { count: "exact", head: true });
    const { streamText } = await import("ai");
    const { getGatewayConfig, textModel } = await import("./gateway.server");
    const cfg = await getGatewayConfig();
    const snapshot = {
      generated_at: new Date().toISOString(),
      settings: {
        video_model: cfg.videoModel, text_model: cfg.textModel, max_duration: cfg.maxDuration,
        generation_enabled: cfg.generationEnabled, allowed_resolutions: cfg.allowedResolutions,
      },
      admins: users ?? 0,
      ...usage,
    };
    try {
      const tm = await textModel(cfg);
      const result = streamText({
        model: tm.model,
        system:
          "Tu es analyste des opérations d'une plateforme de génération vidéo IA. Réponds en français, en Markdown concis. " +
          "Appuie-toi UNIQUEMENT sur les données JSON fournies (30 derniers jours, coûts estimés en crédits). " +
          "Structure : 1) Réponse directe, 2) Constats chiffrés, 3) 3 actions concrètes priorisées. Si une donnée manque, dis-le.",
        prompt: `Question : ${data.question}\n\nDonnées :\n${JSON.stringify(snapshot)}`,
        maxRetries: 0,
        providerOptions: tm.providerOptions as any,
      });
      const text = await result.text;
      if (!text.trim()) return { answer: null, error: "Le modèle n'a pas produit de réponse." };
      return { answer: text, error: null };
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status;
      console.error("insights failed", status, e?.message);
      if (status === 402) return { answer: null, error: "Crédits IA épuisés." };
      if (status === 429) return { answer: null, error: "Trop de demandes, réessayez dans un instant." };
      if (status === 403) return { answer: null, error: "Accès au modèle refusé." };
      return { answer: null, error: "L'analyse a échoué." };
    }
  });
