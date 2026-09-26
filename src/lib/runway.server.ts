import { RUNWAY_MODELS, type RunwayModel } from "./runway-models";

export const RUNWAY_API = "https://api.dev.runwayml.com/v1";
export const runwayHeaders = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "X-Runway-Version": "2024-11-06",
  "Content-Type": "application/json",
});

const TARGET: Record<string, number> = { "360p": 360, "720p": 720, "1080p": 1080, "4k": 2160 };

function pickRatio(m: RunwayModel, aspect: string, resolution: string) {
  if (!m.ratios) return undefined;
  const [aw = 16, ah = 9] = aspect.split(":").map(Number);
  const want = aw / ah;
  const target = TARGET[resolution] ?? 720;
  const parsed = m.ratios.map((r) => {
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

export async function runwayCreate(
  key: string,
  modelId: string,
  opts: { prompt: string; aspect: string; resolution: string; duration: number; image?: { data: string; mimeType: string } | undefined },
): Promise<{ id: string } | { error: string; status: number }> {
  const fallback = RUNWAY_MODELS[0] as RunwayModel;
  let m = RUNWAY_MODELS.find((x) => x.id === modelId) ?? fallback;
  if (!opts.image && !m.t2v) m = fallback; // image-only model: fall back to Gen-4.5 for text
  const body: Record<string, unknown> = {
    model: m.id,
    promptText: opts.prompt.slice(0, 1000),
    duration: pickDuration(m, opts.duration),
  };
  const ratio = pickRatio(m, opts.aspect, opts.resolution);
  if (ratio) body["ratio"] = ratio;
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
    console.error("runway create failed", res.status, text.slice(0, 300));
    return { error: msg, status: res.status };
  }
  return { id: (JSON.parse(text) as { id: string }).id };
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
