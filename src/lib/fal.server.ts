import { DEFAULT_FAL_MODEL, FAL_MODELS, type FalModel } from "./fal-models";

export const FAL_QUEUE = "https://queue.fal.run";

export const falHeaders = (key: string) => ({
  Authorization: `Key ${key}`,
  "Content-Type": "application/json",
});

/** Encode model id for job_id storage (slashes → ~). */
export function falEncodeModel(id: string) {
  return id.replaceAll("/", "~");
}

export function falDecodeModel(encoded: string) {
  return encoded.replaceAll("~", "/");
}

function pickDuration(m: FalModel, d: number) {
  return m.durations.reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a), m.durations[0]!);
}

function pickResolution(m: FalModel, resolution: string) {
  const want = resolution === "360p" ? "480p" : resolution === "4k" && !m.resolutions.includes("4k") ? "1080p" : resolution;
  if (m.resolutions.includes(want)) return want;
  if (want === "1080p" && m.resolutions.includes("720p")) return "720p";
  if (want === "480p" && m.resolutions.includes("720p")) return "720p";
  return m.resolutions[0] ?? "720p";
}

function pickAspect(m: FalModel, aspect: string) {
  if (m.aspects.includes(aspect)) return aspect;
  return m.aspects[0] ?? "16:9";
}

function formatDuration(m: FalModel, seconds: number) {
  return m.durationStyle === "seconds_suffix" ? `${seconds}s` : String(seconds);
}

export async function falCreate(
  key: string,
  modelId: string,
  opts: {
    prompt: string;
    aspect: string;
    resolution: string;
    duration: number;
    image?: { data: string; mimeType: string } | undefined;
  },
): Promise<{ id: string; model: string } | { error: string; status: number }> {
  const fallback = FAL_MODELS.find((x) => x.id === DEFAULT_FAL_MODEL) ?? (FAL_MODELS[0] as FalModel);
  let m = FAL_MODELS.find((x) => x.id === modelId) ?? fallback;
  if (opts.image && !m.i2vId) m = fallback;
  const path = opts.image ? (m.i2vId ?? m.id) : m.id;

  const body: Record<string, unknown> = {
    prompt: opts.prompt.slice(0, m.maxPrompt ?? 2500),
    duration: formatDuration(m, pickDuration(m, opts.duration)),
  };
  if (m.resolutions.length) body["resolution"] = pickResolution(m, opts.resolution);
  if (m.aspects.length && !opts.image) body["aspect_ratio"] = pickAspect(m, opts.aspect);
  if (m.audio) body["generate_audio"] = true;
  if (opts.image) {
    body["image_url"] = `data:${opts.image.mimeType};base64,${opts.image.data}`;
  }

  const res = await fetch(`${FAL_QUEUE}/${path}`, {
    method: "POST",
    headers: falHeaders(key),
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = "La génération Fal.ai a échoué.";
    try {
      const j = JSON.parse(text) as { detail?: string | Array<{ msg?: string }>; message?: string; error?: string };
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail) && j.detail[0]?.msg) msg = j.detail[0].msg;
      else msg = j.message ?? j.error ?? msg;
    } catch {
      /* ignore */
    }
    const noCredits =
      res.status === 402 ||
      res.status === 403 ||
      /insufficient|balance|credit|payment|billing|exhausted/i.test(msg);
    if (noCredits) {
      msg = "Crédits Fal.ai insuffisants. Rechargez sur fal.ai/dashboard/billing (Credits & Tiers).";
    }
    console.error("fal create failed", path, res.status, text.slice(0, 300));
    return { error: msg, status: noCredits ? 402 : res.status };
  }
  const j = JSON.parse(text) as { request_id: string };
  if (!j.request_id) return { error: "Fal.ai n'a pas renvoyé d'identifiant de job.", status: 502 };
  return { id: j.request_id, model: path };
}

export async function falFetch(key: string, modelId: string, requestId: string) {
  const statusRes = await fetch(
    `${FAL_QUEUE}/${modelId}/requests/${encodeURIComponent(requestId)}/status`,
    { headers: falHeaders(key) },
  );
  if (!statusRes.ok) {
    if (statusRes.status === 401 || statusRes.status === 403) {
      return { state: "failed" as const, message: "Clé Fal.ai refusée pendant le rendu." };
    }
    return { state: "pending" as const };
  }
  const st = (await statusRes.json()) as { status?: string; error?: string };
  if (st.status === "FAILED" || st.status === "CANCELLED" || st.status === "ERROR") {
    return { state: "failed" as const, message: st.error ?? "Rendu refusé par Fal.ai." };
  }
  if (st.status !== "COMPLETED") return { state: "pending" as const };

  const res = await fetch(
    `${FAL_QUEUE}/${modelId}/requests/${encodeURIComponent(requestId)}`,
    { headers: falHeaders(key) },
  );
  if (!res.ok) return { state: "pending" as const };
  const j = (await res.json()) as { video?: { url?: string }; detail?: string };
  const url = j.video?.url;
  if (!url) return { state: "failed" as const, message: j.detail ?? "Fal.ai n'a renvoyé aucune vidéo." };
  const content = await fetch(url);
  if (!content.ok) return { state: "pending" as const };
  return { state: "done" as const, bytes: await content.arrayBuffer() };
}

/** Cheap auth check: valid key → 404 on fake request; invalid → 401. */
export async function falTestKey(key: string) {
  const res = await fetch(
    `${FAL_QUEUE}/fal-ai/flux/schnell/requests/00000000-0000-0000-0000-000000000000/status`,
    { headers: falHeaders(key) },
  );
  if (res.status === 401 || res.status === 403) return { ok: false, status: res.status };
  return { ok: true, status: res.status };
}
