import { GATEWAY, gatewayMessage, type GatewayConfig } from "./gateway.server";

const OPENAI_VOICES: Record<string, string> = {
  Kore: "nova",
  Charon: "onyx",
  Aoede: "shimmer",
  Puck: "alloy",
  Fenrir: "echo",
};

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function lovableSpeech(
  apiKey: string,
  spoken: string,
  voice: string,
): Promise<{ audio: string } | { status: number; error: string }> {
  const res = await fetch(`${GATEWAY}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.1-flash-tts-preview",
      contents: [{ role: "user", parts: [{ text: spoken }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
      stream_format: "audio",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    let msg: string | undefined;
    try {
      const p = JSON.parse(body) as { message?: string; error?: { message?: string } };
      msg = p.message ?? p.error?.message;
    } catch {
      /* ignore */
    }
    console.error("lovable tts failed", res.status, body.slice(0, 200));
    return { status: res.status, error: gatewayMessage(res.status, msg) };
  }
  return { audio: toBase64(await res.arrayBuffer()) };
}

async function openaiSpeech(
  apiKey: string,
  text: string,
  voice: string,
): Promise<{ audio: string } | { status: number; error: string }> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "tts-1",
      input: text.slice(0, 4000),
      voice: OPENAI_VOICES[voice] ?? "nova",
      response_format: "mp3",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    let msg: string | undefined;
    try {
      const p = JSON.parse(body) as { error?: { message?: string } };
      msg = p.error?.message;
    } catch {
      /* ignore */
    }
    console.error("openai tts failed", res.status, body.slice(0, 200));
    return { status: res.status, error: gatewayMessage(res.status, msg) };
  }
  return { audio: toBase64(await res.arrayBuffer()) };
}

/** Cascade TTS: Lovable gateway → OpenAI tts-1. */
export async function synthesizeVoiceover(
  cfg: GatewayConfig,
  opts: { text: string; voice: string; tone?: string },
): Promise<{ audio: string } | { error: string }> {
  const spoken = opts.tone ? `Dis sur un ton ${opts.tone} : ${opts.text}` : opts.text;
  const attempts: string[] = [];

  if (cfg.apiKey) {
    const r = await lovableSpeech(cfg.apiKey, spoken, opts.voice);
    if ("audio" in r) return r;
    attempts.push(`Lovable: ${r.error}`);
    if (![401, 402, 403, 404, 429].includes(r.status) && r.status < 500) {
      return { error: r.error };
    }
  }

  if (cfg.openaiKey) {
    const r = await openaiSpeech(cfg.openaiKey, opts.text, opts.voice);
    if ("audio" in r) return r;
    attempts.push(`OpenAI: ${r.error}`);
    return { error: r.error };
  }

  if (!attempts.length) {
    return {
      error:
        "La voix off IA n'est pas configurée. Ajoutez une clé Lovable ou OpenAI dans Admin → Clés API.",
    };
  }
  return { error: `Voix off indisponible. ${attempts.join(" · ")}` };
}
