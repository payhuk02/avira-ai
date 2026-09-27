import { DEFAULT_KLING_MODEL, KLING_MODELS, type KlingModel } from "./kling-models";

/** Kling Open Platform (new API key auth). Docs: https://kling.ai/document-api/guides/get-started/overview */
export const KLING_API = "https://api-singapore.klingai.com";

export const klingHeaders = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
});

type KlingEnvelope = {
  code?: number;
  message?: string;
  data?: { id?: string } | Array<{
    id?: string;
    status?: string;
    message?: string;
    outputs?: Array<{ type?: string; url?: string }>;
  }>;
};

/** Map Kling business codes to HTTP-like statuses for provider cascade. */
export function klingHttpStatus(httpStatus: number, code?: number): number {
  if (httpStatus !== 200) return httpStatus;
  if (code == null || code === 0) return 200;
  if (code >= 1000 && code <= 1004) return 401;
  if (code === 1103) return 403;
  if (code === 1100 || code === 1101 || code === 1102 || code === 1302 || code === 1303 || code === 1304) return 429;
  if (code === 1202 || code === 1203) return 404;
  return 400;
}

function pickDuration(m: KlingModel, d: number) {
  if (m.durations?.length) return m.durations.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a));
  return Math.min(m.max ?? 10, Math.max(m.min ?? 5, Math.round(d)));
}

function pickResolution(m: KlingModel, resolution: string) {
  const want = resolution === "360p" ? "720p" : resolution === "4k" && !m.resolutions.includes("4k") ? "1080p" : resolution;
  return m.resolutions.includes(want) ? want : (m.resolutions[0] ?? "720p");
}

function pickAspect(m: KlingModel, aspect: string) {
  if (m.aspects.includes(aspect)) return aspect;
  return m.aspects[0] ?? "16:9";
}

export async function klingCreate(
  key: string,
  modelId: string,
  opts: { prompt: string; aspect: string; resolution: string; duration: number; image?: { data: string; mimeType: string } | undefined },
): Promise<{ id: string } | { error: string; status: number }> {
  const fallback = KLING_MODELS.find((x) => x.id === DEFAULT_KLING_MODEL) ?? (KLING_MODELS[0] as KlingModel);
  const m = KLING_MODELS.find((x) => x.id === modelId) ?? fallback;
  const path = opts.image ? m.i2vPath : m.t2vPath;
  const settings: Record<string, unknown> = {
    resolution: pickResolution(m, opts.resolution),
    duration: pickDuration(m, opts.duration),
  };
  if (m.audio) settings["audio"] = "off";
  if (!opts.image) settings["aspect_ratio"] = pickAspect(m, opts.aspect);

  const prompt = opts.prompt.slice(0, m.maxPrompt ?? 2500);
  let body: Record<string, unknown>;
  if (opts.image) {
    // Kling i2v accepts URL or Base64; formats: jpg / jpeg / png only (not webp).
    if (opts.image.mimeType === "image/webp") {
      return { error: "Kling n'accepte pas le WebP en image→vidéo (JPG/PNG uniquement).", status: 400 };
    }
    body = {
      contents: [
        { type: "prompt", text: prompt },
        { type: "first_frame", url: `data:${opts.image.mimeType};base64,${opts.image.data}` },
      ],
      settings,
      options: { watermark_info: { enabled: false } },
    };
  } else {
    body = {
      prompt,
      settings,
      options: { watermark_info: { enabled: false } },
    };
  }

  const res = await fetch(`${KLING_API}${path}`, {
    method: "POST",
    headers: klingHeaders(key),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let j: KlingEnvelope = {};
  try {
    j = JSON.parse(text) as KlingEnvelope;
  } catch {
    /* ignore */
  }
  const status = klingHttpStatus(res.status, j.code);
  if (status !== 200 || !j.data || Array.isArray(j.data) || !j.data.id) {
    const msg = j.message || "La génération Kling a échoué.";
    console.error("kling create failed", status, text.slice(0, 300));
    return { error: msg, status };
  }
  return { id: j.data.id };
}

export async function klingFetch(key: string, id: string) {
  const res = await fetch(`${KLING_API}/tasks?task_ids=${encodeURIComponent(id)}`, { headers: klingHeaders(key) });
  if (!res.ok) return { state: "pending" as const };
  const j = (await res.json()) as KlingEnvelope;
  if (j.code && j.code !== 0) return { state: "pending" as const };
  const task = Array.isArray(j.data) ? j.data[0] : undefined;
  if (!task) return { state: "pending" as const };
  if (task.status === "failed")
    return { state: "failed" as const, message: task.message ?? "Rendu refusé par Kling." };
  if (task.status !== "succeeded") return { state: "pending" as const };
  const url = task.outputs?.find((o) => o.type === "video" && o.url)?.url;
  if (!url) return { state: "failed" as const, message: "Kling n'a renvoyé aucune vidéo." };
  const content = await fetch(url);
  if (!content.ok) return { state: "pending" as const };
  return { state: "done" as const, bytes: await content.arrayBuffer() };
}

/** Cheap auth check for Admin → Tester. */
export async function klingTestKey(key: string): Promise<{ ok: boolean; status: number }> {
  const end = Date.now();
  const start = end - 7 * 24 * 60 * 60 * 1000;
  const res = await fetch(`${KLING_API}/account/costs?start_time=${start}&end_time=${end}`, {
    headers: klingHeaders(key),
  });
  if (!res.ok) return { ok: false, status: res.status };
  try {
    const j = (await res.json()) as { code?: number };
    return { ok: j.code === 0 || j.code == null, status: klingHttpStatus(res.status, j.code) };
  } catch {
    return { ok: res.ok, status: res.status };
  }
}
