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

function dayStartIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
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
    .gte("created_at", since);
  const { count: boards } = await supabaseAdmin
    .from("storyboards")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  const video = (clips ?? [])
    .filter((c) => c.status !== "failed")
    .reduce((s, c) => s + (c.duration ?? 0) * limits.costPerVideoSecond, 0);
  return video + (boards ?? 0) * limits.costPerStoryboard;
}

async function countToday(userId: string, table: "clips" | "storyboards"): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", dayStartIso());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function counterToday(subjectId: string, kind: "assist" | "voiceover" | "share"): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("usage_counters")
    .select("count")
    .eq("subject_id", subjectId)
    .eq("day", todayUtcDate())
    .eq("kind", kind)
    .maybeSingle();
  if (error) {
    // Table pas encore migrée : fallback app_config temporaire
    if (error.code === "PGRST205" || /usage_counters/i.test(error.message)) {
      const key = `usage_${kind}_${todayUtcDate()}_${subjectId}`;
      const { data: row } = await supabaseAdmin.from("app_config").select("value").eq("key", key).maybeSingle();
      return row?.value ? Number(row.value) : 0;
    }
    throw new Error(error.message);
  }
  return data?.count ?? 0;
}

async function bumpCounter(subjectId: string, kind: "assist" | "voiceover" | "share"): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const day = todayUtcDate();
  const current = await counterToday(subjectId, kind);
  const next = current + 1;
  const { error } = await supabaseAdmin.from("usage_counters").upsert(
    { subject_id: subjectId, day, kind, count: next, updated_at: new Date().toISOString() },
    { onConflict: "subject_id,day,kind" },
  );
  if (error) {
    if (error.code === "PGRST205" || /usage_counters/i.test(error.message)) {
      const key = `usage_${kind}_${day}_${subjectId}`;
      await supabaseAdmin.from("app_config").upsert({
        key,
        value: String(next),
        is_secret: false,
        updated_at: new Date().toISOString(),
      });
      return next;
    }
    throw new Error(error.message);
  }
  return next;
}

/**
 * Ensures generation is enabled, platform budget is not exhausted,
 * and the user is within their daily quota for the given action.
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

  if (kind === "clip") {
    if (limits.dailyClipLimit <= 0) throw new Error("La génération de clips est désactivée.");
    const n = await countToday(userId, "clips");
    if (n >= limits.dailyClipLimit) {
      throw new Error(`Quota journalier atteint (${limits.dailyClipLimit} clips / jour). Réessayez demain.`);
    }
  } else if (kind === "storyboard") {
    if (limits.dailyStoryboardLimit <= 0) throw new Error("La génération de storyboards est désactivée.");
    const n = await countToday(userId, "storyboards");
    if (n >= limits.dailyStoryboardLimit) {
      throw new Error(`Quota journalier atteint (${limits.dailyStoryboardLimit} storyboards / jour). Réessayez demain.`);
    }
  } else if (kind === "assist") {
    if (limits.dailyAssistLimit <= 0) throw new Error("Les assistants IA sont désactivés.");
    const n = await counterToday(userId, "assist");
    if (n >= limits.dailyAssistLimit) {
      throw new Error(`Quota journalier atteint (${limits.dailyAssistLimit} aides IA / jour). Réessayez demain.`);
    }
    await bumpCounter(userId, "assist");
  } else if (kind === "voiceover") {
    if (limits.dailyVoiceoverLimit <= 0) throw new Error("La voix off IA est désactivée.");
    const n = await counterToday(userId, "voiceover");
    if (n >= limits.dailyVoiceoverLimit) {
      throw new Error(`Quota journalier atteint (${limits.dailyVoiceoverLimit} voix off / jour). Réessayez demain.`);
    }
    await bumpCounter(userId, "voiceover");
  }

  return cfg;
}

/** Limite les lectures de liens de partage (anti-scrape). */
export async function assertShareAllowed(token: string, dailyCap = 200) {
  const subject = `share:${token.slice(0, 24)}`;
  const n = await counterToday(subject, "share");
  if (n >= dailyCap) throw new Error("Trop de consultations pour ce lien aujourd'hui.");
  await bumpCounter(subject, "share");
}

export async function getPublicStudioLimits() {
  const [c, limits] = await Promise.all([getGatewayConfig(), getUsageLimits()]);
  return {
    maxDuration: Math.min(10, Math.max(5, c.maxDuration)),
    generationEnabled: c.generationEnabled,
    allowedResolutions: c.allowedResolutions,
    dailyClipLimit: limits.dailyClipLimit,
    dailyStoryboardLimit: limits.dailyStoryboardLimit,
  };
}
