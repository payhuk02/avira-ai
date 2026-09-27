/**
 * Compteurs d'usage et quotas plateforme.
 * Table `usage_counters` : service_role uniquement (voir migrations Supabase).
 */
import type { GatewayConfig } from "./gateway.server";
import { getGatewayConfig, requireGeneration } from "./gateway.server";

export type UsageKind = "clip" | "storyboard" | "assist" | "voiceover";

export type UsageLimits = {
  monthlyBudget: number;
  alertThreshold: number;
  costPerVideoSecond: number;
  costPerStoryboard: number;
  dailyClipLimit: number;
  dailyStoryboardLimit: number;
  dailyAssistLimit: number;
  dailyVoiceoverLimit: number;
};

const DEFAULTS: UsageLimits = {
  monthlyBudget: 0,
  alertThreshold: 80,
  costPerVideoSecond: 1,
  costPerStoryboard: 0.5,
  dailyClipLimit: 20,
  dailyStoryboardLimit: 10,
  dailyAssistLimit: 40,
  dailyVoiceoverLimit: 20,
};

function num(c: Record<string, string>, k: string, d: number) {
  return c[k] !== undefined && !Number.isNaN(Number(c[k])) ? Number(c[k]) : d;
}

export async function getUsageLimits(): Promise<UsageLimits> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_config").select("key, value").eq("is_secret", false);
    const c = Object.fromEntries((data ?? []).map((r) => [r.key, r.value as string]));
    return {
      monthlyBudget: num(c, "monthly_budget", DEFAULTS.monthlyBudget),
      alertThreshold: num(c, "alert_threshold", DEFAULTS.alertThreshold),
      costPerVideoSecond: num(c, "cost_per_video_second", DEFAULTS.costPerVideoSecond),
      costPerStoryboard: num(c, "cost_per_storyboard", DEFAULTS.costPerStoryboard),
      dailyClipLimit: Math.max(0, Math.floor(num(c, "daily_clip_limit", DEFAULTS.dailyClipLimit))),
      dailyStoryboardLimit: Math.max(0, Math.floor(num(c, "daily_storyboard_limit", DEFAULTS.dailyStoryboardLimit))),
      dailyAssistLimit: Math.max(0, Math.floor(num(c, "daily_assist_limit", DEFAULTS.dailyAssistLimit))),
      dailyVoiceoverLimit: Math.max(0, Math.floor(num(c, "daily_voiceover_limit", DEFAULTS.dailyVoiceoverLimit))),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIso() {
  return new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
}

async function monthCostCredits(limits: UsageLimits): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = monthStartIso();
  const { data: clips } = await supabaseAdmin
    .from("clips")
    .select("status, duration")
    .eq("status", "done")
    .gte("created_at", since);
  const { count: boards } = await supabaseAdmin
    .from("storyboards")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  const video = (clips ?? []).reduce((s, c) => s + (c.duration ?? 0) * limits.costPerVideoSecond, 0);
  return video + (boards ?? 0) * limits.costPerStoryboard;
}

async function counterToday(subjectId: string, kind: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("usage_counters")
    .select("count")
    .eq("subject_id", subjectId)
    .eq("day", todayUtcDate())
    .eq("kind", kind)
    .maybeSingle();
  if (error) {
    if (error.code === "PGRST205" || /usage_counters/i.test(error.message)) {
      const key = `usage_${kind}_${todayUtcDate()}_${subjectId}`;
      const { data: row } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
      return row?.value ? Number(row.value) : 0;
    }
    throw new Error(error.message);
  }
  return data?.count ?? 0;
}

/** Réserve un slot sous plafond (atomique via RPC). Retourne false si plein. */
async function reserveSlot(subjectId: string, kind: string, cap: number): Promise<boolean> {
  if (cap <= 0) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("reserve_usage", {
    _subject_id: subjectId,
    _kind: kind,
    _cap: cap,
  });
  if (!error) return data !== null && data !== undefined;

  // Fallback si migration pas encore appliquée : read-modify-write (meilleur effort).
  if (error.code === "PGRST202" || /reserve_usage|function/i.test(error.message)) {
    const current = await counterToday(subjectId, kind);
    if (current >= cap) return false;
    const day = todayUtcDate();
    const next = current + 1;
    const { error: upErr } = await supabaseAdmin.from("usage_counters").upsert(
      { subject_id: subjectId, day, kind, count: next, updated_at: new Date().toISOString() },
      { onConflict: "subject_id,day,kind" },
    );
    if (upErr) {
      if (upErr.code === "PGRST205" || /usage_counters/i.test(upErr.message)) {
        await supabaseAdmin.from("app_config").upsert({
          key: `usage_${kind}_${day}_${subjectId}`,
          value: String(next),
          is_secret: false,
          updated_at: new Date().toISOString(),
        });
        return true;
      }
      throw new Error(upErr.message);
    }
    return true;
  }
  throw new Error(error.message);
}

/** Libère un slot réservé (échec génération). */
export async function releaseUsage(userId: string, kind: UsageKind): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.rpc("release_usage", {
    _subject_id: userId,
    _kind: kind,
  });
  if (!error) return;
  if (error.code === "PGRST202" || /release_usage|function/i.test(error.message)) {
    const day = todayUtcDate();
    const current = await counterToday(userId, kind);
    if (current <= 0) return;
    const next = current - 1;
    await supabaseAdmin.from("usage_counters").upsert(
      { subject_id: userId, day, kind, count: next, updated_at: new Date().toISOString() },
      { onConflict: "subject_id,day,kind" },
    );
    return;
  }
  console.error("releaseUsage failed", error.message);
}

function quotaMessage(kind: UsageKind, cap: number) {
  const labels: Record<UsageKind, string> = {
    clip: "clips",
    storyboard: "storyboards",
    assist: "aides IA",
    voiceover: "voix off",
  };
  return `Quota journalier atteint (${cap} ${labels[kind]} / jour). Réessayez demain.`;
}

/**
 * Ensures generation is enabled, platform budget is not exhausted,
 * and atomically reserves a daily quota slot for the action.
 * Call releaseUsage(userId, kind) if the action fails after reservation.
 */
export async function assertUsageAllowed(userId: string, kind: UsageKind): Promise<GatewayConfig> {
  const cfg = await requireGeneration();
  const limits = await getUsageLimits();

  if (limits.monthlyBudget > 0) {
    const spent = await monthCostCredits(limits);
    if (spent >= limits.monthlyBudget) {
      throw new Error("Budget mensuel de la plateforme atteint. La génération est suspendue.");
    }
  }

  const caps: Record<UsageKind, number> = {
    clip: limits.dailyClipLimit,
    storyboard: limits.dailyStoryboardLimit,
    assist: limits.dailyAssistLimit,
    voiceover: limits.dailyVoiceoverLimit,
  };
  const disabled: Record<UsageKind, string> = {
    clip: "La génération de clips est désactivée.",
    storyboard: "La génération de storyboards est désactivée.",
    assist: "Les assistants IA sont désactivés.",
    voiceover: "La voix off IA est désactivée.",
  };

  const cap = caps[kind];
  if (cap <= 0) throw new Error(disabled[kind]);
  const ok = await reserveSlot(userId, kind, cap);
  if (!ok) throw new Error(quotaMessage(kind, cap));

  return cfg;
}

/** Limite les lectures de liens de partage (anti-scrape, multi-instance via DB). */
export async function assertShareAllowed(token: string, dailyCap = 200, perMinuteCap = 30) {
  const fp = token.slice(0, 24);
  // Fenêtre 1 minute partagée entre replicas (subject inclut YYYY-MM-DDTHH:MM UTC).
  const minuteKey = new Date().toISOString().slice(0, 16);
  const okMin = await reserveSlot(`share_m:${fp}:${minuteKey}`, "share", perMinuteCap);
  if (!okMin) throw new Error("Trop de consultations pour ce lien. Réessayez dans une minute.");
  const okDay = await reserveSlot(`share:${fp}`, "share", dailyCap);
  if (!okDay) throw new Error("Trop de consultations pour ce lien aujourd'hui.");
}

export async function getPublicStudioLimits() {
  const { hasAiProviderKeys } = await import("./gateway.server");
  const [limits, aiConfigured] = await Promise.all([getUsageLimits(), hasAiProviderKeys()]);
  if (!aiConfigured) {
    return {
      maxDuration: 10,
      generationEnabled: false,
      allowedResolutions: ["360p", "720p", "1080p", "4k"],
      dailyClipLimit: limits.dailyClipLimit,
      dailyStoryboardLimit: limits.dailyStoryboardLimit,
      aiConfigured: false as const,
    };
  }
  const c = await getGatewayConfig();
  return {
    maxDuration: Math.min(10, Math.max(5, c.maxDuration)),
    generationEnabled: c.generationEnabled,
    allowedResolutions: c.allowedResolutions,
    dailyClipLimit: limits.dailyClipLimit,
    dailyStoryboardLimit: limits.dailyStoryboardLimit,
    aiConfigured: true as const,
  };
}

/** Compteurs journaliers utilisateur pour l’UI studio. */
export async function getMyQuotaSnapshot(userId: string) {
  const limits = await getUsageLimits();
  const [clipsUsedToday, storyboardsUsedToday, assistUsedToday] = await Promise.all([
    counterToday(userId, "clip"),
    counterToday(userId, "storyboard"),
    counterToday(userId, "assist"),
  ]);
  return {
    clipsUsedToday,
    storyboardsUsedToday,
    assistUsedToday,
    dailyClipLimit: limits.dailyClipLimit,
    dailyStoryboardLimit: limits.dailyStoryboardLimit,
    dailyAssistLimit: limits.dailyAssistLimit,
  };
}
