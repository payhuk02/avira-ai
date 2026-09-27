import { BRAND, BRAND_URL } from "./brand";

export const OPENROUTER_API = "https://openrouter.ai/api/v1";

type VideoModel = {
  id: string;
  supported_durations?: number[] | null;
  supported_resolutions?: string[] | null;
  supported_aspect_ratios?: string[] | null;
};

const headers = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "HTTP-Referer": BRAND_URL,
  "X-Title": BRAND,
});

const RES_MAP: Record<string, string[]> = {
  "360p": ["480p", "720p", "768p"],
  "720p": ["720p", "768p", "1K", "1080p", "480p"],
  "1080p": ["1080p", "1K", "2K", "720p", "768p"],
  "4k": ["4K", "2K", "1080p", "720p"],
};

/** Statuses that mean "try the next key / model" (credits, auth, quota, rate limit). */
const KEY_EXHAUSTED = new Set([401, 402, 403, 429]);
/** Key is unusable for the rest of this rotate (no credits / invalid) — skip on later models. */
const KEY_DEAD = new Set([401, 402]);

/**
 * For each model, try every usable key. On 401/402 the key is skipped for remaining models.
 * 403/429 still try the next key; other errors (400, 5xx) are returned immediately.
 */
export async function openrouterRotate(
  keys: string[],
  models: string[],
  call: (key: string, model: string, keyIndex: number) => Promise<Response>,
): Promise<Response> {
  let last: Response | null = null;
  const deadKeys = new Set<number>();
  for (const model of [...new Set(models.filter(Boolean))]) {
    for (let i = 0; i < keys.length; i++) {
      if (deadKeys.has(i)) continue;
      const res = await call(keys[i]!, model, i);
      if (!KEY_EXHAUSTED.has(res.status)) return res;
      if (KEY_DEAD.has(res.status)) deadKeys.add(i);
      console.warn("openrouter key exhausted", { keyIndex: i, model, status: res.status });
      last = res;
    }
  }
  return last ?? new Response(JSON.stringify({ error: { message: "Aucune clé OpenRouter configurée." } }), { status: 401 });
}

export async function listOpenRouterVideoModels(): Promise<VideoModel[]> {
  const res = await fetch(`${OPENROUTER_API}/videos/models`);
  if (!res.ok) return [];
  return ((await res.json()) as { data: VideoModel[] }).data;
}

function nearestRatio(list: string[], aspect: string) {
  const [aw = 16, ah = 9] = aspect.split(":").map(Number);
  const want = aw / ah;
  return list.reduce((best, r) => {
    const [w = 1, h = 1] = r.split(":").map(Number);
    const [bw = 1, bh = 1] = best.split(":").map(Number);
    return Math.abs(w / h - want) < Math.abs(bw / bh - want) ? r : best;
  });
}

export async function openrouterVideoCreate(
  keys: string[],
  modelIds: string[],
  opts: { prompt: string; aspect: string; resolution: string; duration: number; image?: { data: string; mimeType: string } | undefined },
): Promise<{ id: string; keyIndex: number } | { error: string; status: number }> {
  const catalogue = await listOpenRouterVideoModels();
  let used = 0;
  const r = await openrouterRotate(keys, modelIds, (key, modelId, i) => {
    used = i;
    return fetch(`${OPENROUTER_API}/videos`, { method: "POST", headers: headers(key), body: JSON.stringify(videoBody(catalogue, modelId, opts)) });
  });
  const text = await r.text();
  if (!r.ok) {
    let msg = "La génération OpenRouter a échoué.";
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string };
      msg = (typeof j.error === "string" ? j.error : j.error?.message) ?? msg;
    } catch {
      /* ignore */
    }
    if (r.status === 402) {
      msg =
        "Crédits OpenRouter insuffisants (compte à 0). Rechargez sur openrouter.ai/settings/credits, ou ajoutez une clé Runway / Google.";
    }
    console.error("openrouter video create failed", r.status, text.slice(0, 300));
    return { error: msg, status: r.status };
  }
  return { id: (JSON.parse(text) as { id: string }).id, keyIndex: used };
}

function videoBody(
  catalogue: VideoModel[],
  modelId: string,
  opts: { prompt: string; aspect: string; resolution: string; duration: number; image?: { data: string; mimeType: string } | undefined },
) {
  const m = catalogue.find((x) => x.id === modelId);
  const body: Record<string, unknown> = { model: modelId, prompt: opts.prompt.slice(0, 4000) };
  if (m?.supported_durations?.length)
    body["duration"] = m.supported_durations.reduce((a, b) => (Math.abs(b - opts.duration) < Math.abs(a - opts.duration) ? b : a));
  else body["duration"] = Math.round(opts.duration);
  if (m?.supported_aspect_ratios?.length) body["aspect_ratio"] = nearestRatio(m.supported_aspect_ratios, opts.aspect);
  else body["aspect_ratio"] = opts.aspect;
  const prefs = RES_MAP[opts.resolution] ?? ["720p"];
  const res = m?.supported_resolutions?.length
    ? prefs.find((r) => m.supported_resolutions!.includes(r)) ?? m.supported_resolutions[0]
    : undefined;
  if (res) body["resolution"] = res;
  if (opts.image)
    body["frame_images"] = [
      { type: "image_url", image_url: { url: `data:${opts.image.mimeType};base64,${opts.image.data}` }, frame_type: "first_frame" },
    ];
  return body;
}

export async function openrouterVideoFetch(key: string, id: string) {
  const r = await fetch(`${OPENROUTER_API}/videos/${encodeURIComponent(id)}`, { headers: headers(key) });
  if (!r.ok) return { state: "pending" as const };
  const j = (await r.json()) as { status: string; unsigned_urls?: string[]; error?: string | { message?: string } };
  if (j.status === "failed" || j.status === "cancelled" || j.status === "expired")
    return {
      state: "failed" as const,
      message: (typeof j.error === "string" ? j.error : j.error?.message) ?? "Rendu refusé par OpenRouter.",
    };
  if (j.status !== "completed") return { state: "pending" as const };
  const url = j.unsigned_urls?.[0] ?? `${OPENROUTER_API}/videos/${encodeURIComponent(id)}/content`;
  const content = await fetch(url, { headers: headers(key) });
  if (!content.ok) return { state: "pending" as const };
  return { state: "done" as const, bytes: await content.arrayBuffer() };
}
