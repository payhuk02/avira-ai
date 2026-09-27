/** Journal des tentatives providers (cascade vidéo) — service_role only. */

export type GenerationOutcome = "ok" | "error" | "skip";

export type GenerationEventInput = {
  userId?: string | null;
  clipId?: string | null;
  provider: string;
  model?: string;
  outcome: GenerationOutcome;
  httpStatus?: number | null;
  latencyMs?: number | null;
  error?: string | null;
};

export async function logGenerationEvent(ev: GenerationEventInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("generation_events").insert({
      user_id: ev.userId ?? null,
      clip_id: ev.clipId ?? null,
      provider: ev.provider.slice(0, 80),
      model: (ev.model ?? "").slice(0, 120),
      outcome: ev.outcome,
      http_status: ev.httpStatus ?? null,
      latency_ms: ev.latencyMs ?? null,
      error: ev.error ? ev.error.slice(0, 500) : null,
    });
    if (error && error.code !== "PGRST205" && !/generation_events/i.test(error.message)) {
      console.error("logGenerationEvent", error.message);
    }
  } catch (e) {
    console.error("logGenerationEvent", e);
  }
}
