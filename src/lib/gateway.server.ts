export const GATEWAY = "https://ai.gateway.lovable.dev/v1";
export const GOOGLE_API = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_VIDEO_MODEL = "google/gemini-omni-1.1-flash";
export const DEFAULT_TEXT_MODEL = "openai/gpt-6-astra";
export const OPENROUTER_API = "https://openrouter.ai/api/v1";
export const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5-mini";
export const DEFAULT_OPENROUTER_VIDEO_MODEL = "x-ai/grok-imagine-video-1.5";
export const DEFAULT_OPENROUTER_VIDEO_FALLBACKS = [
  "x-ai/grok-imagine-video",
  "google/veo-3.1-lite",
  "google/veo-3.1-fast",
  "bytedance/seedance-2.0-fast",
  "bytedance/seedance-2.0-mini",
  "bytedance/seedance-2.0",
  "bytedance/seedance-2.5",
  "alibaba/wan-2.6",
  "alibaba/wan-2.7",
  "alibaba/wan-3.0",
  "minimax/hailuo-2.3",
  "minimax/hailuo-3",
  "kwaivgi/kling-v3.0-std",
  "kwaivgi/kling-v3.0-pro",
];
export const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
export const DEFAULT_GOOGLE_VIDEO_MODEL = "veo-3.1-lite-generate-preview";
export const DEFAULT_GOOGLE_VIDEO_FALLBACKS = [
  "veo-3.1-fast-generate-preview",
  "veo-3.1-generate-preview",
];
export const DEFAULT_RUNWAY_VIDEO_MODEL = "gen4.5";

export type GatewayConfig = {
  apiKey: string;
  openaiKey: string | null;
  googleKey: string | null;
  runwayKey: string | null;
  openrouterKey: string | null;
  openrouterKeys: string[];
  openrouterFallbackModels: string[];
  openrouterVideoFallbacks: string[];
  openrouterModel: string;
  openrouterVideoModel: string;
  runwayVideoModel: string;
  googleVideoFallbacks: string[];
  videoModel: string;
  textModel: string;
  openaiModel: string;
  googleVideoModel: string;
  maxDuration: number;
  generationEnabled: boolean;
  allowedResolutions: string[];
};

async function readConfig(): Promise<Record<string, string>> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_config").select("key, value");
    return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
  } catch {
    return {};
  }
}

export async function getGatewayConfig(): Promise<GatewayConfig> {
  const c = await readConfig();
  const apiKey = c["LOVABLE_API_KEY"] || process.env["LOVABLE_API_KEY"] || "";
  const openaiKey = c["OPENAI_API_KEY"] || process.env["OPENAI_API_KEY"] || null;
  const googleKey = c["GOOGLE_API_KEY"] || process.env["GOOGLE_API_KEY"] || null;
  const runwayKey = c["RUNWAY_API_KEY"] || process.env["RUNWAY_API_KEY"] || null;
  const splitList = (v?: string) => (v ?? "").split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
  const openrouterKeys = [
    ...new Set([c["OPENROUTER_API_KEY"] || process.env["OPENROUTER_API_KEY"] || "", ...splitList(c["OPENROUTER_API_KEYS"])].filter(Boolean)),
  ].slice(0, 101);
  const openrouterKey = openrouterKeys[0] ?? null;
  if (!apiKey && !openrouterKey && !openaiKey && !googleKey && !runwayKey) {
    throw new Error(
      "Aucune clé IA configurée. Ouvrez Administration → Clés API (OpenRouter, Runway, Google ou Lovable), ou ajoutez LOVABLE_API_KEY / OPENROUTER_API_KEY / RUNWAY_API_KEY / GOOGLE_API_KEY dans Vercel.",
    );
  }
  return {
    apiKey,
    openaiKey,
    googleKey,
    runwayKey,
    openrouterKey,
    openrouterKeys,
    openrouterFallbackModels: splitList(c["openrouter_fallback_models"]),
    openrouterVideoFallbacks: (() => {
      const configured = splitList(c["openrouter_video_fallbacks"]);
      if (configured.length) return configured;
      return openrouterKey ? DEFAULT_OPENROUTER_VIDEO_FALLBACKS : [];
    })(),
    openrouterModel: c["openrouter_model"] || DEFAULT_OPENROUTER_MODEL,
    // With an OpenRouter key, default to a video model so clips work without Admin → Paramètres.
    openrouterVideoModel:
      c["openrouter_video_model"] || (openrouterKey ? DEFAULT_OPENROUTER_VIDEO_MODEL : ""),
    runwayVideoModel: c["runway_video_model"] || DEFAULT_RUNWAY_VIDEO_MODEL,
    videoModel: c["video_model"] || DEFAULT_VIDEO_MODEL,
    textModel: c["text_model"] || DEFAULT_TEXT_MODEL,
    openaiModel: c["openai_model"] || DEFAULT_OPENAI_MODEL,
    googleVideoModel: c["google_video_model"] || DEFAULT_GOOGLE_VIDEO_MODEL,
    googleVideoFallbacks: (() => {
      const configured = splitList(c["google_video_fallbacks"]);
      if (configured.length) return configured;
      return googleKey ? DEFAULT_GOOGLE_VIDEO_FALLBACKS : [];
    })(),
    maxDuration: Number(c["max_duration"]) || 60,
    generationEnabled: c["generation_enabled"] !== "false",
    allowedResolutions: c["allowed_resolutions"]
      ? c["allowed_resolutions"].split(",")
      : ["360p", "720p", "1080p", "4k"],
  };
}

export async function requireGeneration() {
  const cfg = await getGatewayConfig();
  if (!cfg.generationEnabled)
    throw new Error("La génération est momentanément suspendue (maintenance).");
  return cfg;
}

/** True if at least one video/text provider key is available (env or app_config). */
export async function hasAiProviderKeys(): Promise<boolean> {
  try {
    await getGatewayConfig();
    return true;
  } catch {
    return false;
  }
}

/** Text model: OpenRouter, then direct OpenAI when an OpenAI key is set, otherwise Lovable AI Gateway. */
export async function textModel(cfg: GatewayConfig) {
  const { createOpenAI } = await import("@ai-sdk/openai");
  if (cfg.openrouterKey) {
    const provider = createOpenAI({
      baseURL: OPENROUTER_API,
      apiKey: cfg.openrouterKey,
      headers: { "HTTP-Referer": "https://avira.ai", "X-Title": "Avira ai" },
      // Rotates keys on credit exhaustion, then falls back to the next model; caps output tokens.
      fetch: async (input, init) => {
        const { openrouterRotate } = await import("./openrouter.server");
        let body: Record<string, unknown> | null = null;
        if (init?.body && typeof init.body === "string") {
          try { body = JSON.parse(init.body); } catch {
            /* ignore invalid JSON */
          }
        }
        if (!body) return fetch(input, init);
        if (body["max_tokens"] == null && body["max_completion_tokens"] == null) body["max_tokens"] = 4000;
        const models = [String(body["model"]), ...cfg.openrouterFallbackModels];
        return openrouterRotate(cfg.openrouterKeys, models, (key, model) => {
          const h = new Headers(init?.headers);
          h.set("Authorization", `Bearer ${key}`);
          return fetch(input, { ...init, headers: h, body: JSON.stringify({ ...body, model }) });
        });
      },
    });
    return { model: provider.chat(cfg.openrouterModel), providerOptions: {} };
  }
  if (cfg.openaiKey) {
    const provider = createOpenAI({ apiKey: cfg.openaiKey });
    return {
      model: provider.responses(cfg.openaiModel.replace(/^openai\//, "")),
      providerOptions: { openai: { reasoningEffort: "low", store: false } },
    };
  }
  if (!cfg.apiKey) throw new Error("Aucune clé configurée pour les storyboards.");
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey: cfg.apiKey,
    headers: { "Lovable-API-Key": cfg.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return {
    model: provider.responses(cfg.textModel),
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  };
}

export function gatewayMessage(status: number, safeMessage?: string) {
  if (safeMessage) return safeMessage;
  if (status === 400) return "Les réglages vidéo demandés ne sont pas valides.";
  if (status === 401) return "Le service de génération vidéo n'est pas configuré.";
  if (status === 402) return "Crédits IA épuisés. Rechargez votre espace de travail.";
  if (status === 429) return "Quota du provider épuisé ou trop de demandes. Réessayez plus tard ou changez de clé.";
  if (status === 403) return "Ce modèle n'est pas accessible pour ce compte.";
  if (status === 404) return "Le service vidéo demandé est momentanément indisponible.";
  return "La génération a échoué.";
}
