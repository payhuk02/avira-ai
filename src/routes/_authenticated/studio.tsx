import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { ShoppingBasket } from "lucide-react";
import { SceneCartPanel, sortCart, useSceneCart } from "@/components/SceneCart";
import type { ReactNode } from "react";
import { Camera, Download, ImagePlus, Mic2, Music2, Sparkles, X } from "lucide-react";
import { z } from "zod";
import {
  AGES,
  AUDIO_MODES,
  CAMERAS,
  FORMATS,
  RESOLUTIONS,
  GENDERS,
  SKIN_TONES,
  VISUAL_STYLES,
  buildPrompt,
  splitDuration,
  type AudioId,
  type CameraId,
  type FormatId,
  type Role,
  type ResolutionId,
  type VisualStyleId,
} from "@/lib/studio";
import { useAuth } from "@/hooks/use-auth";
import { Captions, FileText, Undo2, Wand2 } from "lucide-react";
import { enhancePrompt, generateSubtitles, type Cue } from "@/lib/assist.functions";
import { TEMPLATES, type Template } from "@/lib/templates";
import { downloadText, loadCues, saveCues, toSrt } from "@/lib/subtitles";
import {
  createClip,
  getClipDownloadUrl,
  listClips,
  refreshClip,
  type ClipRow,
} from "@/lib/clips.functions";
import { getStudioLimits } from "@/lib/admin.functions";

const searchSchema = z.object({
  scene: z.string().max(4000).optional(),
  format: z.string().optional(),
  duration: z.number().optional(),
});

export const Route = createFileRoute("/_authenticated/studio")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Studio — Avira ai" },
      {
        name: "description",
        content:
          "Générez des vidéos IA photoréalistes dans tous les formats, avec un casting réaliste : teint de peau, genre et âge au choix.",
      },
      { property: "og:title", content: "Studio — Avira ai" },
      {
        property: "og:description",
        content:
          "Composez, cadrez et générez des clips vidéo photoréalistes en 16:9, 9:16, 1:1, 21:9 ou 4:5.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Studio,
});

type Clip = ClipRow;
type ReferenceImage = { data: string; mimeType: "image/jpeg" | "image/png" | "image/webp"; preview: string; name: string };
type QueuedShot = {
  scene: string;
  prompt: string;
  format: FormatId;
  aspect: "16:9" | "9:16";
  resolution: ResolutionId;
  duration: number;
  referenceImage?: { data: string; mimeType: ReferenceImage["mimeType"] };
};

function Studio() {
  const search = Route.useSearch();
  const { user, ready } = useAuth();
  const create = useServerFn(createClip);
  const refresh = useServerFn(refreshClip);
  const list = useServerFn(listClips);
  const getDownload = useServerFn(getClipDownloadUrl);
  const loadLimits = useServerFn(getStudioLimits);
  const [aiConfigured, setAiConfigured] = useState(true);
  const [scene, setScene] = useState(
    search.scene ??
      "Une femme de 35 ans marche dans une rue de Lyon au crépuscule, plan moyen qui glisse latéralement, ambiance contemplative.",
  );
  const [format, setFormat] = useState<FormatId>(
    (FORMATS.find((f) => f.id === search.format)?.id ?? "16:9") as FormatId,
  );
  const [duration, setDuration] = useState(Math.min(60, Math.max(5, search.duration ?? 10)));
  const [resolution, setResolution] = useState<ResolutionId>("720p");
  const [camera, setCamera] = useState<CameraId>("tracking");
  const [visualStyle, setVisualStyle] = useState<VisualStyleId>("cinema");
  const [audio, setAudio] = useState<AudioId>("natural");
  const [voiceOver, setVoiceOver] = useState("");
  const [referenceImage, setReferenceImage] = useState<ReferenceImage | null>(null);
  const [light, setLight] = useState(62);
  const [grain, setGrain] = useState(40);
  const [useRoles, setUseRoles] = useState(!search.scene);
  const [roles, setRoles] = useState<Role[]>([
    { toneId: "tone-1", genderId: "f", ageId: "30" },
    { toneId: "tone-4", genderId: "m", ageId: "40" },
  ]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enhance = useServerFn(enhancePrompt);
  const subtitles = useServerFn(generateSubtitles);
  const [variants, setVariants] = useState(1);
  const [enhancing, setEnhancing] = useState(false);
  const [previousScene, setPreviousScene] = useState<string | null>(null);
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [showSubs, setShowSubs] = useState(true);
  const [subsBusy, setSubsBusy] = useState(false);
  const [playTime, setPlayTime] = useState(0);
  useEffect(() => {
    setCues(activeId ? loadCues(activeId) : null);
    setPlayTime(0);
  }, [activeId]);
  const polling = useRef<Set<string>>(new Set());
  const queuedShots = useRef<QueuedShot[]>([]);
  const startNextShot = useRef<() => Promise<void>>(async () => {});
  const cart = useSceneCart(user?.id);
  const [picked, setPicked] = useState<string[]>([]);
  const navigate = useNavigate();

  startNextShot.current = async () => {
    const next = queuedShots.current.shift();
    if (!next) return;
    const result = await create({ data: next });
    if (result.error || !result.clip) {
      queuedShots.current = [];
      setError(result.error ?? "La séquence n’a pas pu continuer.");
      return;
    }
    setClips((previous) => [result.clip as Clip, ...previous]);
    setActiveId(result.clip.id);
  };

  useEffect(() => {
    if (!user) {
      setClips([]);
      return;
    }
    list()
      .then((rows) => {
        const recent = rows.slice(0, 12);
        setClips(recent);
        setActiveId((cur) => cur ?? recent.find((c) => c.url)?.id ?? null);
      })
      .catch(() => {});
  }, [user, list]);

  useEffect(() => {
    if (!user) {
      setAiConfigured(true);
      return;
    }
    loadLimits()
      .then((limits) => setAiConfigured(limits.aiConfigured !== false))
      .catch(() => {});
  }, [user, loadLimits]);

  const poll = useCallback(
    (id: string) => {
      if (polling.current.has(id)) return;
      polling.current.add(id);
      const tick = async () => {
        try {
          const row = await refresh({ data: { id } });
          setClips((prev) => prev.map((c) => (c.id === id ? { ...c, ...row } : c)));
          if (row.status === "pending") {
            setTimeout(tick, 7000);
          } else {
            polling.current.delete(id);
            if (queuedShots.current.length) void startNextShot.current();
          }
        } catch {
          setTimeout(tick, 15000);
        }
      };
      setTimeout(tick, 7000);
    },
    [refresh],
  );

  useEffect(() => {
    clips.filter((c) => c.status === "pending").forEach((c) => poll(c.id));
  }, [clips, poll]);

  function buildShots(variant = 0): QueuedShot[] {
    const conf = FORMATS.find((f) => f.id === format);
    if (!conf) return [];
    const segments = splitDuration(duration);
    const variation =
      variants > 1
        ? ` Variation ${variant + 1} of ${variants}: give a distinct interpretation with different framing, composition and blocking.`
        : "";
    return segments.map((segmentDuration, index) => ({
      scene: (variants > 1 ? `[V${variant + 1}] ` : "") + scene.trim().slice(0, 1990),
      prompt: (
        buildPrompt({
          scene, roles, useRoles, light, grain, format, camera, visualStyle, audio, voiceOver,
          hasReferenceImage: Boolean(referenceImage),
          segment: { index, count: segments.length },
        }) + variation
      ).slice(0, 4000),
      format,
      aspect: conf.base,
      resolution,
      duration: segmentDuration,
      ...(referenceImage
        ? { referenceImage: { data: referenceImage.data, mimeType: referenceImage.mimeType } }
        : {}),
    }));
  }

  async function launch(shots: QueuedShot[]) {
    const first = shots.shift();
    if (!first) return;
    queuedShots.current = [...queuedShots.current, ...shots];
    const r = await create({ data: first });
    if (r.error || !r.clip) throw new Error(r.error ?? "La génération a échoué.");
    setClips((prev) => [r.clip as Clip, ...prev]);
    setActiveId(r.clip.id);
  }

  async function generate() {
    if (!scene.trim() || busy || !user) return;
    setBusy(true);
    setError(null);
    try {
      await launch(Array.from({ length: variants }, (_, v) => buildShots(v)).flat());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function applyTemplate(t: Template) {
    setScene(t.scene);
    setFormat(t.format);
    setDuration(t.duration);
    setCamera(t.camera);
    setVisualStyle(t.visualStyle);
    setAudio(t.audio);
    setVoiceOver(t.voiceOver ?? "");
  }

  async function improveScene() {
    if (scene.trim().length < 3 || enhancing) return;
    setEnhancing(true);
    setError(null);
    try {
      const r = await enhance({ data: { scene: scene.trim().slice(0, 2000) } });
      if (r.error || !r.text) throw new Error(r.error ?? "Aucune proposition.");
      setPreviousScene(scene);
      setScene(r.text);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnhancing(false);
    }
  }

  async function makeSubtitles(clip: Clip) {
    setSubsBusy(true);
    setError(null);
    try {
      const r = await subtitles({
        data: {
          scene: `${clip.scene}${voiceOver ? `\nVoix off : ${voiceOver}` : ""}`.slice(0, 4000),
          duration: clip.duration,
          language: "français",
        },
      });
      if (r.error || !r.cues) throw new Error(r.error ?? "Sous-titres indisponibles.");
      saveCues(clip.id, r.cues);
      setCues(r.cues);
      setShowSubs(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubsBusy(false);
    }
  }

  function addToCart() {
    if (!scene.trim()) return;
    const shots = buildShots();
    cart.add({
      id: crypto.randomUUID(),
      scene: scene.trim().slice(0, 2000),
      priority: "normal",
      format,
      resolution,
      duration,
      shots,
      createdAt: Date.now(),
    });
  }

  async function produceCart() {
    if (busy || !user || !cart.items.length) return;
    setBusy(true);
    setError(null);
    try {
      const ordered = sortCart(cart.items);
      await launch(ordered.flatMap((item) => item.shots.map((shot) => ({ ...shot }))));
      cart.clear();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function selectReference(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choisissez une image JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 2_500_000) {
      setError("L’image de référence doit peser moins de 2,5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = typeof reader.result === "string" ? reader.result : "";
      const data = encoded.split(",")[1];
      if (!data) return;
      setReferenceImage({
        data,
        mimeType: file.type as ReferenceImage["mimeType"],
        preview: encoded,
        name: file.name,
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function downloadClip(id: string) {
    setError(null);
    try {
      const file = await getDownload({ data: { id } });
      const anchor = document.createElement("a");
      anchor.href = file.url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const activeClip = clips.find((c) => c.id === activeId) ?? null;
  const previewFormat = FORMATS.find((f) => f.id === (activeClip?.format ?? format))!;

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_300px]">
          {/* LEFT: casting */}
          <aside className="rise2 order-2 lg:order-1">
            <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">Casting</h2>
                <button
                  onClick={() => setUseRoles((v) => !v)}
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60 hover:text-foreground"
                >
                  {useRoles ? "Actif" : "Ignoré"}
                </button>
              </div>

              {roles.map((role, i) => (
                <div key={i} className={i === 0 ? "mt-5" : "mt-5 border-t border-border pt-5"}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    {i === 0 ? "Rôle 01 — Protagoniste" : "Rôle 02 — Second plan"}
                  </p>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                        Teint de peau
                      </p>
                      <div className="flex gap-1.5">
                        {SKIN_TONES.map((t) => (
                          <button
                            key={t.id}
                            title={t.label}
                            aria-label={t.label}
                            onClick={() =>
                              setRoles((prev) =>
                                prev.map((r, idx) => (idx === i ? { ...r, toneId: t.id } : r)),
                              )
                            }
                            style={{ backgroundColor: t.hex }}
                            className={`size-6 rounded-full ${
                              role.toneId === t.id
                                ? "ring-2 ring-primary ring-offset-2 ring-offset-paper"
                                : ""
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Genre</p>
                      <div className="flex flex-wrap gap-1.5">
                        {GENDERS.map((g) => (
                          <button
                            key={g.id}
                            onClick={() =>
                              setRoles((prev) =>
                                prev.map((r, idx) => (idx === i ? { ...r, genderId: g.id } : r)),
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              role.genderId === g.id
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground ring-1 ring-white/5 hover:bg-white/5"
                            }`}
                          >
                            {g.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Âge</p>
                      <div className="flex flex-wrap gap-1.5">
                        {AGES.map((a) => (
                          <button
                            key={a.id}
                            onClick={() =>
                              setRoles((prev) =>
                                prev.map((r, idx) => (idx === i ? { ...r, ageId: a.id } : r)),
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              role.ageId === a.id
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground ring-1 ring-white/5 hover:bg-white/5"
                            }`}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          {/* CENTER */}
          <section className="rise order-1 lg:order-2">
            <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl leading-tight sm:text-3xl">
                  Composeur de prompt
                </h1>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                  Scène {String(clips.length + 1).padStart(2, "0")}
                </span>
              </div>
              {!aiConfigured ? (
                <div className="mt-4 rounded-[10px] bg-destructive/10 px-4 py-3 text-sm text-destructive ring-1 ring-destructive/30">
                  <p className="font-medium">Aucune clé IA configurée</p>
                  <p className="mt-1 text-destructive/90">
                    Ajoutez une clé (Lovable, OpenRouter, Runway, Kling ou Google) dans{" "}
                    <Link to="/admin/cles-api" className="underline underline-offset-2 hover:text-destructive">
                      Admin → Clés API
                    </Link>{" "}
                    ou via les variables d’environnement Vercel, puis redéployez.
                  </p>
                </div>
              ) : null}
              <div className="mt-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">Modèles prêts à l'emploi</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="shrink-0 rounded-[10px] bg-background px-3 py-2 text-left ring-1 ring-white/5 transition-colors hover:ring-primary"
                    >
                      <span className="block text-xs font-medium">{t.label}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground/70">{t.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-4 rounded-[10px] bg-background p-4 ring-1 ring-white/5">
                <textarea
                  value={scene}
                  onChange={(e) => setScene(e.target.value)}
                  rows={4}
                  placeholder="Décrivez la scène, la lumière, le mouvement de caméra…"
                  className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={improveScene}
                  disabled={enhancing || scene.trim().length < 3 || !user}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-medium text-primary-deep ring-1 ring-primary/30 transition-colors hover:bg-primary/25 disabled:opacity-50"
                >
                  <Wand2 className="size-3.5" />
                  {enhancing ? "Réécriture…" : "Améliorer avec l'IA"}
                </button>
                {previousScene !== null && (
                  <button
                    type="button"
                    onClick={() => { setScene(previousScene); setPreviousScene(null); }}
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Undo2 className="size-3.5" /> Annuler
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1 rounded-full bg-background p-1 ring-1 ring-white/5">
                  <span className="px-2 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">Variantes</span>
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setVariants(n)}
                      className={`size-7 rounded-full text-xs font-medium transition-colors ${variants === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary-deep">
                  {previewFormat.id}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {duration}s
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {resolution}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {useRoles ? "Casting appliqué" : "Sans casting"}
                </span>
                {variants > 1 && (
                  <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                    {variants} variantes
                  </span>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="mt-5 rounded-[14px] bg-card p-4 ring-1 ring-white/10 sm:p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Aperçu — {previewFormat.id}
                  </span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
                  {activeClip
                    ? `${activeClip.resolution} · ${activeClip.duration}s`
                    : `${resolution} · ${duration}s`}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-[10px]">
                <div
                  className={`w-full ${previewFormat.boxClass} grid place-items-center overflow-hidden bg-muted-foreground/30`}
                >
                  {activeClip?.url ? (
                    <div className="relative size-full">
                      <video
                        key={activeClip.id}
                        src={activeClip.url ?? undefined}
                        controls
                        autoPlay
                        loop
                        playsInline
                        onTimeUpdate={(e) => setPlayTime(e.currentTarget.currentTime)}
                        className="size-full object-cover"
                      />
                      {showSubs && cues
                        ? (() => {
                            const cue = cues.find((c) => playTime >= c.start && playTime < c.end);
                            return cue ? (
                              <p className="pointer-events-none absolute inset-x-6 bottom-14 text-center">
                                <span className="rounded-md bg-background/75 px-3 py-1.5 text-sm font-medium leading-relaxed text-foreground backdrop-blur-sm sm:text-base">
                                  {cue.text}
                                </span>
                              </p>
                            ) : null;
                          })()
                        : null}
                    </div>
                  ) : (
                    <div className="px-6 text-center">
                      <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                        {activeClip?.status === "pending"
                          ? "Rendu en cours…"
                          : activeClip?.status === "failed"
                            ? "Rendu échoué"
                            : "Aucun clip sélectionné"}
                      </p>
                      {activeClip?.error ? (
                        <p className="mt-2 text-xs text-muted-foreground">{activeClip.error}</p>
                      ) : null}
                    </div>
                  )}
                </div>
                <div className="filmtrack pointer-events-none absolute inset-y-0 left-0 w-3 bg-white/40" />
                <div className="filmtrack pointer-events-none absolute inset-y-0 right-0 w-3 bg-white/40" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <p className="font-mono text-[11px] text-muted-foreground/70">
                Rendu {resolution} · 24 ips · ~1 à 3 min
              </p>
              <div className="flex flex-wrap items-center gap-2">
              {activeClip?.url ? (
                <button
                  type="button"
                  onClick={() => downloadClip(activeClip.id)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/85"
                >
                  <Download className="size-4" />
                  Télécharger le rendu
                </button>
              ) : null}
              {activeClip?.url && user ? (
                <button
                  type="button"
                  onClick={() => makeSubtitles(activeClip)}
                  disabled={subsBusy}
                  className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-medium ring-1 ring-white/10 transition-colors hover:ring-primary disabled:opacity-50"
                >
                  <Captions className="size-4" />
                  {subsBusy ? "Écriture…" : cues ? "Régénérer les sous-titres" : "Sous-titres IA"}
                </button>
              ) : null}
              {activeClip && cues?.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => setShowSubs((v) => !v)}
                    className="rounded-full bg-paper px-3 py-2.5 text-xs font-medium ring-1 ring-white/10 hover:ring-primary"
                  >
                    {showSubs ? "Masquer" : "Afficher"}
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(`avira-${activeClip.id}.srt`, toSrt(cues))}
                    className="inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-2.5 text-xs font-medium ring-1 ring-white/10 hover:ring-primary"
                  >
                    <FileText className="size-3.5" /> .srt
                  </button>
                </>
              ) : null}
              {ready && !user ? (
                <Link to="/auth" className="inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black">
                  Connectez-vous pour générer
                </Link>
              ) : (
              <button
                onClick={generate}
                disabled={busy || !scene.trim() || !aiConfigured}
                className="group inline-flex items-center gap-2.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground ring-1 ring-primary/40 transition-colors hover:bg-primary-deep hover:text-primary-foreground disabled:opacity-50"
              >
                <span className="grid size-4 place-items-center">
                  <span className="size-2.5 rounded-full bg-current" />
                </span>
                {busy ? "Envoi…" : variants > 1 ? `Générer ${variants} variantes` : "Générer le clip"}
              </button>
              )}
              {user && (
                <button
                  onClick={addToCart}
                  disabled={!scene.trim()}
                  className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2.5 text-sm font-medium ring-1 ring-white/10 transition-colors hover:ring-primary disabled:opacity-50"
                >
                  <ShoppingBasket className="size-4" /> Ajouter au panier
                </button>
              )}
              </div>
            </div>
            {error ? (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            ) : null}
          </section>

          {/* RIGHT */}
          <aside className="rise3 order-3">
            <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
              <h2 className="font-display text-xl">Format d'image</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Le cadrage redimensionne l'aperçu en direct.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-[10px] p-3 text-left transition-colors ${
                      format === f.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-background ring-1 ring-white/5 hover:bg-white/5"
                    }`}
                  >
                    <div
                      className="mb-2 rounded-[6px] bg-current/15"
                      style={{ aspectRatio: f.ratio }}
                    />
                    <p className="text-xs font-medium">{f.id}</p>
                    <p className="font-mono text-[10px] opacity-60">{f.label}</p>
                  </button>
                ))}
              </div>

              <div className="my-5 h-px bg-border" />

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-muted-foreground">Résolution d'export</p>
                  <span className="font-mono text-[10px] text-primary-deep">{resolution}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {RESOLUTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setResolution(option.id)}
                      aria-pressed={resolution === option.id}
                      className={`rounded-[8px] px-3 py-2 text-left transition-colors ${
                        resolution === option.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-background ring-1 ring-white/5 hover:bg-white/5"
                      }`}
                    >
                      <span className="block text-xs font-medium">{option.label}</span>
                      <span className="block truncate font-mono text-[9px] opacity-60">{option.detail}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="my-5 h-px bg-border" />

              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-muted-foreground">Durée totale</p>
                  <span className="font-mono text-[10px] text-primary-deep">{duration}s</span>
                </div>
                <div className="mt-2 grid grid-cols-6 gap-1">
                  {[5, 10, 15, 30, 45, 60].map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      onClick={() => setDuration(seconds)}
                      aria-pressed={duration === seconds}
                      className={`rounded-[6px] py-1.5 font-mono text-[9px] transition-colors ${duration === seconds ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground ring-1 ring-white/5"}`}
                    >
                      {seconds}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Durée totale"
                  type="range"
                  min={5}
                  max={60}
                  step={1}
                  value={duration}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  className="mt-3 h-1.5 w-full cursor-pointer accent-primary"
                />
                <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                  {splitDuration(duration).length} plan{splitDuration(duration).length > 1 ? "s" : ""} généré{splitDuration(duration).length > 1 ? "s" : ""} successivement.
                </p>
              </div>
              <div className="mt-4">
                <Dial label="Lumière" value={light} min={0} max={100} step={1} suffix="%" onChange={setLight} />
              </div>
              <div className="mt-4">
                <Dial label="Grain" value={grain} min={0} max={100} step={1} suffix="%" onChange={setGrain} />
              </div>
            </div>
          </aside>
        </div>

        <section className="mt-5 rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="size-4 text-primary-deep" />
            <div>
              <h2 className="font-display text-xl">Direction créative</h2>
              <p className="text-xs text-muted-foreground">Référence, mouvement, rendu et bande-son.</p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><ImagePlus className="size-3.5" /> Image de référence</p>
              {referenceImage ? (
                <div className="relative overflow-hidden rounded-[8px] bg-background ring-1 ring-white/5">
                  <img src={referenceImage.preview} alt="Référence sélectionnée" className="h-24 w-full object-cover" />
                  <button type="button" aria-label="Retirer l’image" onClick={() => setReferenceImage(null)} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-white/10 text-foreground backdrop-blur-sm"><X className="size-3.5" /></button>
                  <p className="truncate px-3 py-2 text-[10px] text-muted-foreground">{referenceImage.name}</p>
                </div>
              ) : (
                <label className="grid h-[126px] cursor-pointer place-items-center rounded-[8px] border border-dashed border-border bg-background text-center hover:bg-white/5">
                  <span><ImagePlus className="mx-auto size-5 text-primary-deep" /><span className="mt-2 block text-xs font-medium">Importer une image</span><span className="mt-1 block text-[10px] text-muted-foreground">JPG, PNG ou WebP · 2,5 Mo max.</span></span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectReference(event.target.files?.[0])} />
                </label>
              )}
            </div>
            <OptionGrid icon={<Camera className="size-3.5" />} label="Mouvement caméra" options={CAMERAS} value={camera} onChange={(value) => setCamera(value as CameraId)} />
            <OptionGrid icon={<Sparkles className="size-3.5" />} label="Style visuel" options={VISUAL_STYLES} value={visualStyle} onChange={(value) => setVisualStyle(value as VisualStyleId)} />
            <div>
              <OptionGrid icon={<Music2 className="size-3.5" />} label="Bande-son" options={AUDIO_MODES} value={audio} onChange={(value) => setAudio(value as AudioId)} />
              <label className="mt-3 block">
                <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"><Mic2 className="size-3.5" /> Voix off</span>
                <input value={voiceOver} onChange={(event) => setVoiceOver(event.target.value.slice(0, 240))} placeholder="Texte optionnel…" className="h-9 w-full rounded-[7px] bg-background px-3 text-xs outline-none ring-1 ring-white/5 focus:ring-primary" />
              </label>
            </div>
          </div>
        </section>

        {user && (
          <SceneCartPanel cart={cart} busy={busy} onProduce={produceCart} />
        )}

        {/* Timeline */}
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl leading-tight">Timeline de clips</h2>
              <p className="text-sm text-muted-foreground">
                Cochez vos rendus puis assemblez-les en une seule vidéo.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
                {clips.length} clip{clips.length > 1 ? "s" : ""}
              </span>
              {clips.some((c) => c.status === "done" && c.url) && (
                <button
                  type="button"
                  onClick={() => {
                    const ready = clips.filter((c) => c.status === "done" && c.url).map((c) => c.id);
                    setPicked(picked.length === ready.length ? [] : ready);
                  }}
                  className="rounded-full px-3 py-1.5 text-xs ring-1 ring-white/10 hover:ring-primary"
                >
                  {picked.length && picked.length === clips.filter((c) => c.status === "done" && c.url).length ? "Tout désélectionner" : "Tout sélectionner"}
                </button>
              )}
              <button
                type="button"
                disabled={!picked.length}
                onClick={() => {
                  const ordered = [...clips].reverse().filter((c) => picked.includes(c.id)).map((c) => c.id);
                  sessionStorage.setItem("avira-montage-selection", JSON.stringify(ordered));
                  navigate({ to: "/montage" });
                }}
                className="rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
              >
                Assembler en une vidéo ({picked.length})
              </button>
            </div>
          </div>

          {clips.length === 0 ? (
            <div className="rounded-[12px] bg-paper p-8 text-center ring-1 ring-white/5">
              <p className="text-sm text-muted-foreground">
                Aucun clip pour l'instant. Décrivez une scène, choisissez le casting et lancez un
                rendu.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {clips.map((clip) => {
                const conf = FORMATS.find((f) => f.id === clip.format)!;
                const isPicked = picked.includes(clip.id);
                return (
                  <button
                    key={clip.id}
                    onClick={() => clip.url && setActiveId(clip.id)}
                    className={`rise overflow-hidden rounded-[12px] bg-paper text-left ring-1 transition-shadow ${
                      isPicked ? "ring-2 ring-primary" : activeId === clip.id ? "ring-primary" : "ring-white/5"
                    }`}
                  >
                    <div className="relative">
                      <div className="aspect-[16/9] w-full overflow-hidden bg-muted-foreground/25">
                        {clip.url ? (
                          <video
                            src={clip.url ?? undefined}
                            muted
                            playsInline
                            preload="metadata"
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="grid size-full place-items-center">
                            <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
                              {clip.status === "pending" ? "Rendu…" : "Échec"}
                            </span>
                          </div>
                        )}
                      </div>
                      {clip.status === "done" && clip.url && (
                        <span
                          role="checkbox"
                          aria-checked={isPicked}
                          aria-label="Sélectionner pour l'assemblage"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPicked((p) => (p.includes(clip.id) ? p.filter((x) => x !== clip.id) : [...p, clip.id]));
                          }}
                          className={`absolute left-2 top-2 grid size-7 place-items-center rounded-md text-sm font-bold ring-1 ${
                            isPicked ? "bg-primary text-primary-foreground ring-primary" : "bg-black/70 text-transparent ring-white/40"
                          }`}
                        >
                          ✓
                        </span>
                      )}
                      <span className="absolute bottom-2 left-2 rounded-full bg-black/80 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm">
                        {clip.duration}s
                      </span>
                      <span
                        className={`absolute right-2 top-2 rounded-full px-2 py-0.5 font-mono text-[10px] ${
                          clip.status === "done"
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/80 text-white backdrop-blur-sm"
                        }`}
                      >
                        {clip.status === "done"
                          ? "Rendu"
                          : clip.status === "pending"
                            ? "En cours"
                            : "Échec"}
                      </span>
                    </div>
                    <div className="p-3">
                      <p className="truncate text-sm font-medium">{clip.scene}</p>
                      <p className="font-mono text-[10px] text-muted-foreground/70">
                        {conf.id} · {clip.resolution} · 24ips
                      </p>
                      {clip.status === "pending" ? (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
                        </div>
                      ) : null}
                      {clip.error ? (
                        <p className="mt-1 text-[11px] text-destructive">{clip.error}</p>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
    </main>
  );
}

function OptionGrid({ icon, label, options, value, onChange }: { icon: ReactNode; label: string; options: { id: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">{icon}{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button key={option.id} type="button" onClick={() => onChange(option.id)} aria-pressed={value === option.id} className={`min-h-10 rounded-[8px] px-2.5 text-left text-xs font-medium transition-colors ${value === option.id ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground ring-1 ring-white/5 hover:bg-white/5"}`}>{option.label}</button>
        ))}
      </div>
    </div>
  );
}

function Dial({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        <span className="font-mono text-[10px] text-primary-deep">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full appearance-none rounded-full bg-white/10 accent-primary"
        aria-label={label}
      />
    </div>
  );
}
