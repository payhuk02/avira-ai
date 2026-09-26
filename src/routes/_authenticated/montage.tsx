import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, Film, Mic, Music, Play, Plus, Captions, Settings2, Sparkles, Square, X } from "lucide-react";
import { listClips, type ClipRow } from "@/lib/clips.functions";
import { generateVoiceover, VOICES } from "@/lib/projects.functions";

export const Route = createFileRoute("/_authenticated/montage")({
  head: () => ({
    meta: [
      { title: "Montage automatique — Avira ai" },
      { name: "description", content: "Assemblez vos scènes générées en un seul film, avec transitions, puis exportez-le." },
      { property: "og:title", content: "Montage automatique — Avira ai" },
      { property: "og:description", content: "Ordonnez vos clips IA, choisissez les transitions et exportez un film final." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Montage,
});

const RATIOS: Record<string, [number, number]> = { "16:9": [16, 9], "9:16": [9, 16], "1:1": [1, 1], "21:9": [21, 9], "4:5": [4, 5] };
const RESOLUTIONS = [{ id: 720, label: "720p" }, { id: 1080, label: "1080p Full HD" }, { id: 1440, label: "1440p 2K" }, { id: 2160, label: "2160p 4K" }];
const FPS = [24, 25, 30, 60];
const QUALITIES = [
  { id: "standard", label: "Standard", bits: 4 },
  { id: "high", label: "Haute", bits: 10 },
  { id: "master", label: "Master", bits: 24 },
] as const;
const even = (n: number) => Math.round(n / 2) * 2;
function dims(ratio: string, short: number): [number, number] {
  const [a, b] = RATIOS[ratio] ?? [16, 9];
  return a >= b ? [even((short * a) / b), short] : [short, even((short * b) / a)];
}
type Cue = { id: string; start: number; end: number; text: string };
type SubStyle = { size: number; color: string; box: boolean; position: "bottom" | "top" | "middle"; font: string };
const SUB_COLORS = [{ v: "#ffffff", l: "Blanc" }, { v: "#ffd84a", l: "Jaune" }, { v: "#c4a6ff", l: "Violet" }];
const SUB_FONTS = [{ v: "Inter, sans-serif", l: "Inter" }, { v: "'Playfair Display', serif", l: "Playfair" }, { v: "'JetBrains Mono', monospace", l: "Mono" }];
function drawSubs(ctx: CanvasRenderingContext2D, cues: Cue[], st: SubStyle, time: number, w: number, h: number) {
  const cue = cues.find((c) => time >= c.start && time < c.end && c.text.trim());
  if (!cue) return;
  const px = Math.round((Math.min(w, h) / 1080) * st.size);
  ctx.save();
  ctx.font = `600 ${px}px ${st.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const words = cue.text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > w * 0.84 && line) { lines.push(line); line = word; } else line = test;
  }
  lines.push(line);
  const lh = px * 1.3;
  const blockH = lines.length * lh;
  const top = st.position === "top" ? h * 0.08 : st.position === "middle" ? (h - blockH) / 2 : h * 0.9 - blockH;
  lines.forEach((l, i) => {
    const y = top + i * lh + lh / 2;
    if (st.box) {
      const tw = ctx.measureText(l).width;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(w / 2 - tw / 2 - px * 0.4, y - lh / 2, tw + px * 0.8, lh);
    } else {
      ctx.lineWidth = Math.max(2, px / 8);
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(l, w / 2, y);
    }
    ctx.fillStyle = st.color;
    ctx.fillText(l, w / 2, y);
  });
  ctx.restore();
}
const fmtSrt = (t: number) => {
  const ms = Math.round(t * 1000);
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
type Track = { name: string; buffer: AudioBuffer | null; volume: number; offset: number; trimStart: number; trimEnd: number; fadeIn: number; fadeOut: number };
const emptyTrack = (): Track => ({ name: "", buffer: null, volume: 0.8, offset: 0, trimStart: 0, trimEnd: 0, fadeIn: 1, fadeOut: 2 });
type Transition = "cut" | "fade" | "white" | "zoom" | "slide" | "blur" | "wipe";
const TRANSITIONS: { id: Transition; label: string }[] = [
  { id: "cut", label: "Coupe franche" },
  { id: "fade", label: "Fondu noir" },
  { id: "white", label: "Fondu blanc" },
  { id: "zoom", label: "Zoom" },
  { id: "slide", label: "Glissé" },
  { id: "blur", label: "Flou" },
  { id: "wipe", label: "Volet" },
];
const FADE = 0.6;

function Montage() {
  const list = useServerFn(listClips);
  const { data: clips = [], isLoading } = useQuery({ queryKey: ["clips"], queryFn: () => list() });
  const done = clips.filter((c) => c.status === "done" && c.url);
  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem("avira-montage-selection") ?? "[]");
      if (Array.isArray(saved) && saved.length) setOrder(saved);
      sessionStorage.removeItem("avira-montage-selection");
    } catch {
      /* ignore corrupt session selection */
    }
  }, []);
  const [transition, setTransition] = useState<Transition>("fade");
  const [state, setState] = useState<"idle" | "preview" | "export">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef(false);

  const sequence = order.map((id) => done.find((c) => c.id === id)).filter((c): c is ClipRow & { url: string } => !!c?.url);
  const [ratio, setRatio] = useState<string>("auto");
  const [res, setRes] = useState(1080);
  const [fps, setFps] = useState(30);
  const [quality, setQuality] = useState<(typeof QUALITIES)[number]["id"]>("high");
  const [container, setContainer] = useState<"webm" | "mp4">("webm");
  const [clipVolume, setClipVolume] = useState(1);
  const [music, setMusic] = useState<Track>(emptyTrack);
  const [voice, setVoice] = useState<Track>(() => ({ ...emptyTrack(), volume: 1, fadeIn: 0.3, fadeOut: 0.5 }));
  const [cues, setCues] = useState<Cue[]>([]);
  const [subStyle, setSubStyle] = useState<SubStyle>({ size: 48, color: "#ffffff", box: false, position: "bottom", font: "Inter, sans-serif" });
  const [subsOn, setSubsOn] = useState(true);
  const format = ratio === "auto" ? (sequence[0]?.format ?? "16:9") : ratio;
  const [w, h] = dims(format, res);
  const mp4Supported = typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.("video/mp4");
  const total = sequence.reduce((s, c) => s + c.duration, 0);

  const move = (i: number, d: number) =>
    setOrder((o) => {
      const n = [...o];
      const j = i + d;
      if (j < 0 || j >= n.length) return o;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });

  async function run(record: boolean) {
    const canvas = canvasRef.current;
    if (!canvas || !sequence.length) return;
    setError(null);
    stopRef.current = false;
    setState(record ? "export" : "preview");
    setProgress(0);
    const ctx = canvas.getContext("2d")!;
    const audio = new AudioContext();
    const dest = audio.createMediaStreamDestination();
    let recorder: MediaRecorder | null = null;
    const chunks: Blob[] = [];
    if (record) {
      const stream = new MediaStream([...canvas.captureStream(fps).getVideoTracks(), ...dest.stream.getAudioTracks()]);
      const candidates = container === "mp4"
        ? ["video/mp4;codecs=avc1,mp4a", "video/mp4"]
        : ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
      const mime = candidates.find((m) => MediaRecorder.isTypeSupported(m));
      const bits = QUALITIES.find((q) => q.id === quality)!.bits * (w * h) / (1920 * 1080) * (fps / 30);
      recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: Math.round(Math.max(2, bits) * 1_000_000), audioBitsPerSecond: 192_000 });
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.start(250);
    }
    const sources: AudioBufferSourceNode[] = [];
    const t0 = audio.currentTime + 0.05;
    for (const tr of [music, voice]) {
      if (!tr.buffer) continue;
      const end = tr.trimEnd > tr.trimStart ? tr.trimEnd : tr.buffer.duration;
      const len = Math.min(end - tr.trimStart, Math.max(0, total - tr.offset));
      if (len <= 0) continue;
      const node = audio.createBufferSource();
      node.buffer = tr.buffer;
      const g = audio.createGain();
      const start = t0 + tr.offset;
      const fi = Math.min(tr.fadeIn, len / 2), fo = Math.min(tr.fadeOut, len / 2);
      g.gain.setValueAtTime(fi > 0 ? 0 : tr.volume, start);
      if (fi > 0) g.gain.linearRampToValueAtTime(tr.volume, start + fi);
      g.gain.setValueAtTime(tr.volume, start + len - fo);
      if (fo > 0) g.gain.linearRampToValueAtTime(0, start + len);
      node.connect(g);
      g.connect(dest);
      if (!record) g.connect(audio.destination);
      node.start(start, tr.trimStart, len);
      sources.push(node);
    }
    let elapsed = 0;
    try {
      for (const clip of sequence) {
        if (stopRef.current) break;
        const video = document.createElement("video");
        video.crossOrigin = "anonymous";
        video.src = clip.url;
        video.playsInline = true;
        await new Promise<void>((res, rej) => {
          video.oncanplay = () => res();
          video.onerror = () => rej(new Error("Un clip n'a pas pu être chargé."));
        });
        const src = audio.createMediaElementSource(video);
        const gain = audio.createGain();
        src.connect(gain);
        gain.connect(dest);
        if (!record) gain.connect(audio.destination);
        await video.play();
        await new Promise<void>((res) => {
          const draw = () => {
            if (stopRef.current || video.ended) return res();
            const d = video.duration || clip.duration;
            const t = video.currentTime;
            const e = transition === "cut" ? 1 : Math.max(0, Math.min(1, t / FADE, (d - t) / FADE));
            const zoom = transition === "zoom" ? 1 + (1 - e) * 0.2 : 1;
            const scale = Math.max(w / video.videoWidth, h / video.videoHeight) * zoom;
            const vw = video.videoWidth * scale, vh = video.videoHeight * scale;
            ctx.save();
            ctx.globalAlpha = 1;
            ctx.filter = "none";
            ctx.fillStyle = transition === "white" ? "#fff" : "#000";
            ctx.fillRect(0, 0, w, h);
            let dx = 0;
            if (transition === "slide") dx = (1 - e) * w * (t < d / 2 ? 1 : -1);
            if (transition === "wipe") { ctx.beginPath(); ctx.rect(0, 0, w * e, h); ctx.clip(); }
            if (transition === "blur") ctx.filter = `blur(${(1 - e) * 24}px)`;
            if (["fade", "white", "zoom", "blur"].includes(transition)) ctx.globalAlpha = e;
            gain.gain.value = e * clipVolume;
            ctx.drawImage(video, (w - vw) / 2 + dx, (h - vh) / 2, vw, vh);
            ctx.restore();
            if (subsOn) drawSubs(ctx, cues, subStyle, elapsed + t, w, h);
            setProgress(Math.min(1, (elapsed + t) / Math.max(1, total)));
            requestAnimationFrame(draw);
          };
          video.onended = () => res();
          draw();
        });
        elapsed += clip.duration;
        video.pause();
        src.disconnect();
      }
      if (recorder) {
        await new Promise<void>((res) => { recorder!.onstop = () => res(); recorder!.stop(); });
        if (!stopRef.current) {
          const url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
          const a = document.createElement("a");
          a.href = url;
          a.download = `avira-montage-${w}x${h}-${fps}ips-${Date.now()}.${recorder.mimeType.includes("mp4") ? "mp4" : "webm"}`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }
      }
    } catch (e) {
      if (recorder?.state === "recording") recorder.stop();
      setError((e as Error).message);
    } finally {
      sources.forEach((n) => {
        try {
          n.stop();
        } catch {
          /* ignore stop errors */
        }
      });
      audio.close();
      setState("idle");
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
          <h2 className="font-display text-xl">Vos rendus</h2>
          <p className="mt-1 text-xs text-muted-foreground">Ajoutez les scènes à assembler dans l'ordre voulu.</p>
          {done.length > 0 && (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setOrder([...done].reverse().map((c) => c.id))}
                className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                <Plus className="size-3" /> Tout ajouter ({done.length})
              </button>
              {order.length > 0 && (
                <button type="button" onClick={() => setOrder([])} className="rounded-full px-3 py-1.5 text-xs ring-1 ring-white/10 hover:ring-destructive">Vider</button>
              )}
            </div>
          )}
          <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
            {!isLoading && !done.length && <p className="text-sm text-muted-foreground">Aucun rendu terminé pour l'instant.</p>}
            {done.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-[10px] bg-background p-2 ring-1 ring-white/5">
                <video src={c.url ?? undefined} muted className="h-12 w-20 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{c.scene}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{c.format} · {c.duration}s</p>
                </div>
                <button
                  type="button"
                  aria-label="Ajouter au montage"
                  onClick={() => setOrder((o) => [...o, c.id])}
                  className="grid size-8 place-items-center rounded-full bg-primary/15 text-primary-deep hover:bg-primary/25"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-[14px] bg-card p-4 ring-1 ring-white/10">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Film — {format} · {w}×{h} · {fps} ips · {total}s · {sequence.length} scène{sequence.length > 1 ? "s" : ""}
              </span>
              <div className="flex flex-wrap items-center gap-1 rounded-[14px] bg-background p-1 ring-1 ring-white/5">
                {TRANSITIONS.map((t) => (
                  <button key={t.id} type="button" onClick={() => setTransition(t.id)}
                    className={`rounded-full px-3 py-1 text-xs ${transition === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid place-items-center overflow-hidden rounded-[10px] bg-background">
              <canvas ref={canvasRef} width={w} height={h} className="max-h-[60vh] w-full object-contain" style={{ aspectRatio: `${w}/${h}` }} />
            </div>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {state === "idle" ? (
                <>
                  <button type="button" disabled={!sequence.length} onClick={() => run(false)}
                    className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-medium ring-1 ring-white/10 hover:ring-primary disabled:opacity-50">
                    <Play className="size-4" /> Aperçu du film
                  </button>
                  <button type="button" disabled={!sequence.length} onClick={() => run(true)}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                    <Download className="size-4" /> Exporter le film
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { stopRef.current = true; }}
                  className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-medium ring-1 ring-white/10">
                  <Square className="size-4" /> {state === "export" ? "Annuler l'export" : "Arrêter"}
                </button>
              )}
              {state === "export" && <span className="self-center text-xs text-muted-foreground">Export en temps réel… {Math.round(progress * 100)} %</span>}
            </div>
            {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>

          <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
            <h2 className="flex items-center gap-2 font-display text-xl"><Settings2 className="size-4" /> Réglages d'export</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Choice label="Format d'image" value={ratio} onChange={setRatio}
                options={[{ v: "auto", l: "Auto (1er clip)" }, ...Object.keys(RATIOS).map((r) => ({ v: r, l: r }))]} />
              <Choice label="Résolution" value={String(res)} onChange={(v) => setRes(Number(v))}
                options={RESOLUTIONS.map((r) => ({ v: String(r.id), l: r.label }))} />
              <Choice label="Images par seconde" value={String(fps)} onChange={(v) => setFps(Number(v))}
                options={FPS.map((f) => ({ v: String(f), l: `${f} ips` }))} />
              <Choice label="Qualité" value={quality} onChange={(v) => setQuality(v as typeof quality)}
                options={QUALITIES.map((q) => ({ v: q.id, l: q.label }))} />
              <Choice label="Fichier" value={container} onChange={(v) => setContainer(v as "webm" | "mp4")}
                options={[{ v: "webm", l: "WebM" }, ...(mp4Supported ? [{ v: "mp4", l: "MP4" }] : [])]} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Sortie {w}×{h} à {fps} ips. Les clips sources sont agrandis si la résolution choisie est supérieure à leur rendu.
            </p>
          </div>

          <SubtitleEditor cues={cues} setCues={setCues} style={subStyle} setStyle={setSubStyle} on={subsOn} setOn={setSubsOn} total={total} />

          <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
            <h2 className="font-display text-xl">Pistes audio</h2>
            <div className="mt-3">
              <Slider label="Son des clips" value={clipVolume} min={0} max={1} step={0.05} onChange={setClipVolume} fmt={(v) => `${Math.round(v * 100)} %`} />
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <TrackEditor icon={<Music className="size-4" />} title="Musique" track={music} setTrack={setMusic} total={total} />
              <div className="space-y-3">
                <VoiceGenerator onReady={(buffer) => setVoice({ ...voice, name: "Voix off IA", buffer, trimStart: 0, trimEnd: buffer.duration })} />
                <TrackEditor icon={<Mic className="size-4" />} title="Voix off" track={voice} setTrack={setVoice} total={total} />
              </div>
            </div>
          </div>

          <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
            <h2 className="flex items-center gap-2 font-display text-xl"><Film className="size-4" /> Timeline</h2>
            {!sequence.length && <p className="mt-2 text-sm text-muted-foreground">Ajoutez des scènes depuis la liste.</p>}
            <ol className="mt-3 space-y-2">
              {sequence.map((c, i) => (
                <li key={`${c.id}-${i}`} className="flex items-center gap-3 rounded-[10px] bg-background p-2 ring-1 ring-white/5">
                  <span className="w-6 text-center font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <p className="min-w-0 flex-1 truncate text-sm">{c.scene}</p>
                  <span className="font-mono text-[10px] text-muted-foreground">{c.duration}s</span>
                  <button type="button" aria-label="Monter" onClick={() => move(i, -1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowUp className="size-4" /></button>
                  <button type="button" aria-label="Descendre" onClick={() => move(i, 1)} className="p-1 text-muted-foreground hover:text-foreground"><ArrowDown className="size-4" /></button>
                  <button type="button" aria-label="Retirer" onClick={() => setOrder((o) => o.filter((_, k) => k !== i))} className="p-1 text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </main>
  );
}

function Choice({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { v: string; l: string }[] }) {
  return (
    <div>
      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o.v} type="button" onClick={() => onChange(o.v)} aria-pressed={value === o.v}
            className={`rounded-full px-3 py-1 text-xs ring-1 ${value === o.v ? "bg-primary text-primary-foreground ring-primary" : "text-muted-foreground ring-white/10 hover:ring-primary"}`}>
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between text-muted-foreground"><span>{label}</span><span className="font-mono">{fmt(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-primary" />
    </label>
  );
}

function VoiceGenerator({ onReady }: { onReady: (b: AudioBuffer) => void }) {
  const tts = useServerFn(generateVoiceover);
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState<(typeof VOICES)[number]["id"]>("Charon");
  const [tone, setTone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await tts({ data: { text, voice: voiceId, tone: tone || undefined } });
      if (res.error || !res.audio) { setErr(res.error ?? "Aucun audio reçu."); return; }
      const bin = Uint8Array.from(atob(res.audio), (c) => c.charCodeAt(0));
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(bin.buffer);
      ctx.close();
      onReady(buffer);
    } catch (e) {
      setErr((e as Error).message || "La voix off a échoué.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-[10px] bg-background p-4 ring-1 ring-primary/30">
      <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-primary" /> Voix off IA</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} rows={3} placeholder="Écrivez le texte de la narration…"
        className="mt-3 w-full resize-y rounded-md bg-paper px-3 py-2 text-xs outline-none ring-1 ring-white/10 focus:ring-primary" />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select value={voiceId} onChange={(e) => setVoiceId(e.target.value as typeof voiceId)} className="rounded-md bg-paper px-2 py-1.5 text-xs ring-1 ring-white/10">
          {VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <input value={tone} onChange={(e) => setTone(e.target.value)} maxLength={80} placeholder="Ton (ex. solennel)" className="rounded-md bg-paper px-2 py-1.5 text-xs ring-1 ring-white/10" />
      </div>
      <button type="button" onClick={run} disabled={busy || text.trim().length < 2} className="mt-3 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-50">
        {busy ? "Enregistrement de la voix…" : "Générer et placer sur la piste"}
      </button>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

function TrackEditor({ icon, title, track, setTrack, total }: { icon: React.ReactNode; title: string; track: Track; setTrack: (t: Track) => void; total: number }) {
  const [err, setErr] = useState<string | null>(null);
  const len = track.buffer?.duration ?? 0;
  const s = (v: number) => `${v.toFixed(1)} s`;
  const up = (p: Partial<Track>) => setTrack({ ...track, ...p });
  async function load(file: File) {
    setErr(null);
    try {
      const ctx = new AudioContext();
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      ctx.close();
      setTrack({ ...track, name: file.name, buffer, trimStart: 0, trimEnd: buffer.duration });
    } catch {
      setErr("Fichier audio illisible.");
    }
  }
  return (
    <div className="rounded-[10px] bg-background p-4 ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">{icon} {title}</p>
        {track.buffer && (
          <button type="button" onClick={() => setTrack({ ...emptyTrack(), volume: track.volume })} className="text-xs text-muted-foreground hover:text-destructive">Retirer</button>
        )}
      </div>
      <label className="mt-3 block cursor-pointer rounded-[8px] border border-dashed border-white/15 px-3 py-2 text-center text-xs text-muted-foreground hover:border-primary">
        {track.buffer ? `${track.name} · ${s(len)}` : "Importer un fichier audio (MP3, WAV, M4A…)"}
        <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      </label>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      {track.buffer && (
        <div className="mt-3 space-y-2">
          <Slider label="Volume" value={track.volume} min={0} max={1.5} step={0.05} onChange={(v) => up({ volume: v })} fmt={(v) => `${Math.round(v * 100)} %`} />
          <Slider label="Début dans le film" value={track.offset} min={0} max={Math.max(0, total)} step={0.1} onChange={(v) => up({ offset: v })} fmt={s} />
          <Slider label="Découpe — début" value={track.trimStart} min={0} max={len} step={0.1} onChange={(v) => up({ trimStart: Math.min(v, track.trimEnd - 0.5) })} fmt={s} />
          <Slider label="Découpe — fin" value={track.trimEnd} min={0} max={len} step={0.1} onChange={(v) => up({ trimEnd: Math.max(v, track.trimStart + 0.5) })} fmt={s} />
          <Slider label="Fondu d'entrée" value={track.fadeIn} min={0} max={10} step={0.1} onChange={(v) => up({ fadeIn: v })} fmt={s} />
          <Slider label="Fondu de sortie" value={track.fadeOut} min={0} max={10} step={0.1} onChange={(v) => up({ fadeOut: v })} fmt={s} />
        </div>
      )}
    </div>
  );
}

function SubtitleEditor({ cues, setCues, style, setStyle, on, setOn, total }: {
  cues: Cue[]; setCues: (c: Cue[]) => void; style: SubStyle; setStyle: (s: SubStyle) => void; on: boolean; setOn: (b: boolean) => void; total: number;
}) {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  const up = (id: string, p: Partial<Cue>) => setCues(cues.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const add = () => {
    const last = sorted.at(-1);
    const start = Math.min(last ? last.end : 0, Math.max(0, total - 1));
    setCues([...cues, { id: crypto.randomUUID(), start, end: Math.min(start + 3, Math.max(total, start + 1)), text: "" }]);
  };
  const exportSrt = () => {
    const body = sorted.map((c, i) => `${i + 1}\n${fmtSrt(c.start)} --> ${fmtSrt(c.end)}\n${c.text}\n`).join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url; a.download = "avira-montage.srt"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const num = "w-16 rounded-[6px] bg-paper px-2 py-1 font-mono text-xs ring-1 ring-white/10 focus:outline-none focus:ring-primary";
  return (
    <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl"><Captions className="size-4" /> Sous-titres</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="accent-primary" /> Incruster dans le film
          </label>
          {cues.length > 0 && <button type="button" onClick={exportSrt} className="rounded-full px-3 py-1 text-xs ring-1 ring-white/10 hover:ring-primary">.srt</button>}
          <button type="button" onClick={add} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"><Plus className="size-3" /> Ajouter</button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Choice label="Police" value={style.font} onChange={(v) => setStyle({ ...style, font: v })} options={SUB_FONTS.map((f) => ({ v: f.v, l: f.l }))} />
        <Choice label="Couleur" value={style.color} onChange={(v) => setStyle({ ...style, color: v })} options={SUB_COLORS} />
        <Choice label="Position" value={style.position} onChange={(v) => setStyle({ ...style, position: v as SubStyle["position"] })}
          options={[{ v: "bottom", l: "Bas" }, { v: "middle", l: "Centre" }, { v: "top", l: "Haut" }]} />
        <Choice label="Fond" value={style.box ? "box" : "outline"} onChange={(v) => setStyle({ ...style, box: v === "box" })}
          options={[{ v: "outline", l: "Contour" }, { v: "box", l: "Bandeau" }]} />
        <Slider label="Taille" value={style.size} min={24} max={96} step={2} onChange={(v) => setStyle({ ...style, size: v })} fmt={(v) => `${v}`} />
      </div>
      {!sorted.length && <p className="mt-4 text-sm text-muted-foreground">Aucun sous-titre. Cliquez sur « Ajouter » pour écrire le premier.</p>}
      <ol className="mt-4 space-y-2">
        {sorted.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-background p-2 ring-1 ring-white/5">
            <input type="number" aria-label="Début (s)" min={0} step={0.1} value={c.start} className={num}
              onChange={(e) => up(c.id, { start: Math.max(0, Number(e.target.value)) })} />
            <span className="text-xs text-muted-foreground">→</span>
            <input type="number" aria-label="Fin (s)" min={0} step={0.1} value={c.end} className={num}
              onChange={(e) => up(c.id, { end: Math.max(c.start + 0.1, Number(e.target.value)) })} />
            <input type="text" value={c.text} placeholder="Texte du sous-titre" maxLength={140}
              onChange={(e) => up(c.id, { text: e.target.value })}
              className="min-w-[180px] flex-1 rounded-[6px] bg-paper px-2 py-1 text-sm ring-1 ring-white/10 focus:outline-none focus:ring-primary" />
            <button type="button" aria-label="Supprimer" onClick={() => setCues(cues.filter((x) => x.id !== c.id))} className="p-1 text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
          </li>
        ))}
      </ol>
    </div>
  );
}
