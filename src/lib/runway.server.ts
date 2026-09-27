import { DEFAULT_RUNWAY_MODEL, RUNWAY_MODELS, type RunwayModel } from "./runway-models";

export const RUNWAY_API = "https://api.dev.runwayml.com/v1";
export const runwayHeaders = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "X-Runway-Version": "2024-11-06",
  "Content-Type": "application/json",
});

const TARGET: Record<string, number> = { "360p": 360, "720p": 720, "1080p": 1080, "4k": 2160 };

/** Statuses where another model or key may still succeed. */
const RUNWAY_RETRY = new Set([404, 412, 429]);
/** Key unusable for the rest of this rotate. */
const RUNWAY_KEY_DEAD = new Set([401, 403]);

function pickRatio(ratios: string[], aspect: string, resolution: string) {
  const [aw = 16, ah = 9] = aspect.split(":").map(Number);
  const want = aw / ah;
  const target = TARGET[resolution] ?? 720;
  const parsed = ratios.map((r) => {
    const [w = 1, h = 1] = r.split(":").map(Number);
    return { r, a: w / h, short: Math.min(w, h) };
  });
  const best = Math.min(...parsed.map((p) => Math.abs(p.a - want)));
  const close = parsed.filter((p) => Math.abs(p.a - want) - best < 0.02);
  close.sort((x, y) => Math.abs(x.short - target) - Math.abs(y.short - target));
  return close[0]?.r;
}

function pickDuration(m: RunwayModel, d: number) {
  if (m.durations) return m.durations.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a));
  return Math.min(m.max ?? 10, Math.max(m.min ?? 5, Math.round(d)));
}

function pickResolution(m: RunwayModel, resolution: string): string | undefined {
  if (!m.resolutions?.length) return undefined;
  const want = resolution === "4k" ? "2k" : resolution;
  const lower = m.resolutions.map((r) => r.toLowerCase());
  const idx = lower.indexOf(want.toLowerCase());
  if (idx >= 0) return m.resolutions[idx];
  if (want === "720p" || want === "1080p") {
    const mid = lower.findIndex((r) => r === "768p" || r === "720p");
    if (mid >= 0) return m.resolutions[mid];
  }
  if (want === "360p" || want === "480p") {
    const low = lower.findIndex((r) => r === "480p" || r === "768p" || r === "720p");
    if (low >= 0) return m.resolutions[low];
  }
  return m.resolutions[0];
}

function pickWanAutoRatio(resolution: string) {
  if (resolution === "1080p" || resolution === "4k") return "auto_1080p";
  if (resolution === "360p") return "auto_480p";
  return "auto_720p";
}

export async function runwayOrgInfo(key: string): Promise<
  { ok: true; creditBalance: number; status: number } | { ok: false; status: number }
> {
  const res = await fetch(`${RUNWAY_API}/organization`, { headers: runwayHeaders(key) });
  if (!res.ok) return { ok: false, status: res.status };
  const j = (await res.json()) as { creditBalance?: number };
  return { ok: true, status: res.status, creditBalance: Number(j.creditBalance ?? 0) };
}

export async function runwayCreate(
  key: string,
  modelId: string,
  opts: { prompt: string; aspect: string; resolution: string; duration: number; image?: { data: string; mimeType: string } | undefined },
): Promise<{ id: string } | { error: string; status: number }> {
  const fallback = RUNWAY_MODELS.find((x) => x.id === DEFAULT_RUNWAY_MODEL) ?? (RUNWAY_MODELS[0] as RunwayModel);
  let m = RUNWAY_MODELS.find((x) => x.id === modelId) ?? fallback;
  if (!opts.image && !m.t2v) m = fallback;
  const hasImage = !!opts.image;
  const body: Record<string, unknown> = {
    model: m.id,
    promptText: opts.prompt.slice(0, m.maxPrompt ?? 1000),
    duration: pickDuration(m, opts.duration),
  };

  const resTier = pickResolution(m, opts.resolution);
  if (resTier) body["resolution"] = resTier;

  if (hasImage && m.i2vAutoRatio) {
    body["ratio"] = pickWanAutoRatio(opts.resolution);
  } else if (hasImage && m.i2vRatioFromImage) {
    // aspect follows input image
  } else if (hasImage && m.id === "hailuo3") {
    body["ratio"] = "adaptive";
  } else {
    const ratios = hasImage && m.i2vRatios ? m.i2vRatios : m.ratios;
    if (ratios?.length) {
      const ratio = pickRatio(ratios, opts.aspect, opts.resolution);
      if (ratio) body["ratio"] = ratio;
    }
  }

  if (opts.image) body["promptImage"] = `data:${opts.image.mimeType};base64,${opts.image.data}`;
  const res = await fetch(`${RUNWAY_API}/${opts.image ? "image_to_video" : "text_to_video"}`, {
    method: "POST",
    headers: runwayHeaders(key),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "La génération Runway a échoué.";
    try {
      const j = JSON.parse(text) as { error?: string; message?: string };
      msg = j.error ?? j.message ?? msg;
    } catch {
      /* ignore */
    }
    // 412 = not enough credits for this model/task — another cheaper model or key may still work.
    const noCredits = res.status === 412 || /enough credits|insufficient credit/i.test(msg);
    if (noCredits) {
      msg = `Crédits Runway insuffisants pour ${m.id}. Rechargez sur dev.runwayml.com, ou la cascade essaie un autre modèle / provider.`;
    }
    console.error("runway create failed", m.id, res.status, text.slice(0, 300));
    return { error: msg, status: noCredits ? 412 : res.status };
  }
  return { id: (JSON.parse(text) as { id: string }).id };
}

/**
 * Outer loop = models, inner = keys (like OpenRouter).
 * 412/404/429 → try next key then next model. 401/403 → mark key dead.
 */
export async function runwayCreateRotating(
  keys: string[],
  modelIds: string[],
  opts: { prompt: string; aspect: string; resolution: string; duration: number; image?: { data: string; mimeType: string } | undefined },
): Promise<{ id: string; keyIndex: number } | { error: string; status: number }> {
  const models = [...new Set(modelIds.filter(Boolean))];
  const usable = keys.filter(Boolean);
  if (!usable.length) return { error: "Aucune clé Runway configurée.", status: 401 };
  let last: { error: string; status: number } | null = null;
  const dead = new Set<number>();
  for (const model of models) {
    for (let i = 0; i < usable.length; i++) {
      if (dead.has(i)) continue;
      const r = await runwayCreate(usable[i]!, model, opts);
      if (!("error" in r)) return { id: r.id, keyIndex: i };
      last = { error: r.error, status: r.status };
      if (RUNWAY_KEY_DEAD.has(r.status)) {
        dead.add(i);
        console.warn("runway key dead", { keyIndex: i, model, status: r.status });
        continue;
      }
      if (RUNWAY_RETRY.has(r.status)) {
        console.warn("runway model/key retry", { keyIndex: i, model, status: r.status });
        continue;
      }
      return last;
    }
  }
  return last ?? { error: "La génération Runway a échoué.", status: 502 };
}

export async function runwayFetch(key: string, id: string) {
  const res = await fetch(`${RUNWAY_API}/tasks/${encodeURIComponent(id)}`, { headers: runwayHeaders(key) });
  if (!res.ok) return { state: "pending" as const };
  const t = (await res.json()) as { status: string; output?: string[]; failure?: string };
  if (t.status === "FAILED" || t.status === "CANCELLED")
    return { state: "failed" as const, message: t.failure ?? "Rendu refusé par Runway." };
  if (t.status !== "SUCCEEDED" || !t.output?.[0]) return { state: "pending" as const };
  const content = await fetch(t.output[0]);
  if (!content.ok) return { state: "pending" as const };
  return { state: "done" as const, bytes: await content.arrayBuffer() };
}
