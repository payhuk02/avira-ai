import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Download, FolderPlus, Link2, Music4, Search, Share2, Trash2, Wand2 } from "lucide-react";
import { FORMATS } from "@/lib/studio";
import {
  deleteClip,
  getClipDownloadUrl,
  listClips,
  restyleClip,
  saveMusicBrief,
  STYLE_PRESETS,
  type ClipRow,
} from "@/lib/clips.functions";
import { generateMusicBrief } from "@/lib/assist.functions";
import {
  createProject,
  deleteProject,
  listProjects,
  setClipProject,
  setClipSharing,
} from "@/lib/projects.functions";
import { BRAND } from "@/lib/brand";

const SOCIAL_PRESETS = [
  { id: "tiktok", label: "TikTok / Reels", format: "9:16", tip: "Vertical plein écran, idéal 9:16." },
  { id: "youtube", label: "YouTube", format: "16:9", tip: "Paysage classique, idéal 16:9 en 1080p." },
  { id: "instagram", label: "Instagram", format: "1:1", tip: "Carré pour le fil, vertical pour les stories." },
  { id: "shorts", label: "Shorts", format: "9:16", tip: "Vertical court, moins de 60 secondes." },
] as const;

export const Route = createFileRoute("/_authenticated/bibliotheque")({
  head: () => ({
    meta: [
      { title: `Ma bibliothèque — ${BRAND}` },
      { name: "description", content: "Retrouvez toutes vos vidéos IA générées, conservées durablement." },
      { property: "og:title", content: `Ma bibliothèque — ${BRAND}` },
      { property: "og:description", content: "Vos clips vidéo IA, rangés et prêts à télécharger." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Library,
});

function Library() {
  const qc = useQueryClient();
  const list = useServerFn(listClips);
  const del = useServerFn(deleteClip);
  const getDownload = useServerFn(getClipDownloadUrl);
  const restyle = useServerFn(restyleClip);
  const musicBrief = useServerFn(generateMusicBrief);
  const saveBrief = useServerFn(saveMusicBrief);
  const { data: clips = [], isLoading } = useQuery({ queryKey: ["clips"], queryFn: () => list() });
  const projectsFn = useServerFn(listProjects);
  const newProject = useServerFn(createProject);
  const removeProject = useServerFn(deleteProject);
  const moveClip = useServerFn(setClipProject);
  const share = useServerFn(setClipSharing);
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: () => projectsFn() });
  const [project, setProject] = useState<string>("all");
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<ClipRow | null>(null);
  const [query, setQuery] = useState("");
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function patchClip(id: string, patch: Partial<ClipRow>) {
    qc.setQueryData<ClipRow[]>(["clips"], (p = []) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setOpen((o) => (o && o.id === id ? { ...o, ...patch } : o));
  }

  async function addProject() {
    const name = window.prompt("Nom du projet");
    if (!name?.trim()) return;
    const row = await newProject({ data: { name: name.trim() } });
    qc.setQueryData(["projects"], [...projects, row]);
    setProject(row.id);
  }

  async function toggleShare(clip: ClipRow, enabled: boolean) {
    setBusy("share");
    setNotice(null);
    try {
      const res = await share({ data: { clipId: clip.id, enabled } });
      patchClip(clip.id, { share_token: res.token });
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const shareUrl = (token: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/f/${token}`;

  async function restyleAs(clip: ClipRow, stylePreset: string) {
    setBusy(`style-${stylePreset}`);
    setNotice(null);
    try {
      const res = await restyle({ data: { id: clip.id, stylePreset } });
      if (res.error) setNotice(res.error);
      else {
        setNotice("Version re-stylisée lancée. Elle apparaîtra dans la bibliothèque une fois terminée.");
        qc.invalidateQueries({ queryKey: ["clips"] });
      }
    } finally {
      setBusy(null);
    }
  }

  async function makeMusicBrief(clip: ClipRow) {
    setBusy("music");
    setNotice(null);
    try {
      const res = await musicBrief({ data: { scene: clip.scene, duration: clip.duration } });
      if (res.error || !res.text) setNotice(res.error ?? "Aucune proposition.");
      else {
        await saveBrief({ data: { id: clip.id, brief: res.text } });
        setOpen({ ...clip, music_brief: res.text });
        qc.setQueryData<ClipRow[]>(["clips"], (p = []) =>
          p.map((x) => (x.id === clip.id ? { ...x, music_brief: res.text } : x)),
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function downloadClip(id: string) {
    setDownloadError(null);
    try {
      const file = await getDownload({ data: { id } });
      const anchor = document.createElement("a");
      anchor.href = file.url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (e) {
      setDownloadError((e as Error).message);
    }
  }

  const shown = clips.filter(
    (c) =>
      (filter === "all" || c.format === filter) &&
      (project === "all" || (project === "none" ? !c.project_id : c.project_id === project)) &&
      c.scene.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr")),
  );

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl">Ma bibliothèque</h1>
            <p className="text-sm text-muted-foreground">
              {clips.length} clip{clips.length > 1 ? "s" : ""} conservé{clips.length > 1 ? "s" : ""} durablement.
            </p>
          </div>
           <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-56 items-center gap-2 rounded-md bg-paper px-3 ring-1 ring-white/10 focus-within:ring-primary">
              <Search className="size-4 text-muted-foreground" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher un clip"
                className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
              />
            </label>
            {["all", ...FORMATS.map((f) => f.id)].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground ring-1 ring-white/5 hover:bg-white/5"
                }`}
              >
                {f === "all" ? "Tous" : f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-border/60 py-3">
          <span className="mr-1 font-mono text-[10px] uppercase text-muted-foreground">Projets</span>
          {[{ id: "all", name: "Tous les clips" }, ...projects, { id: "none", name: "Sans projet" }].map((p) => (
            <span key={p.id} className="group inline-flex items-center">
              <button
                onClick={() => setProject(p.id)}
                className={`rounded-md px-3 py-1.5 text-xs ${
                  project === p.id ? "bg-secondary text-secondary-foreground ring-1 ring-primary" : "text-muted-foreground ring-1 ring-white/5 hover:bg-white/5"
                }`}
              >
                {p.name}
                <span className="ml-1.5 opacity-50">
                  {p.id === "all" ? clips.length : clips.filter((c) => (p.id === "none" ? !c.project_id : c.project_id === p.id)).length}
                </span>
              </button>
              {p.id !== "all" && p.id !== "none" && project === p.id ? (
                <button
                  aria-label={`Supprimer le projet ${p.name}`}
                  onClick={async () => {
                    if (!window.confirm(`Supprimer le projet « ${p.name} » ? Les clips sont conservés.`)) return;
                    await removeProject({ data: { id: p.id } });
                    qc.invalidateQueries({ queryKey: ["projects"] });
                    qc.invalidateQueries({ queryKey: ["clips"] });
                    setProject("all");
                  }}
                  className="ml-1 p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </span>
          ))}
          <button onClick={addProject} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-primary ring-1 ring-primary/40 hover:bg-primary/10">
            <FolderPlus className="size-3.5" /> Nouveau projet
          </button>
        </div>


        {open ? (
          <div className="mt-6 rounded-[14px] bg-card p-4 ring-1 ring-white/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="truncate text-sm text-muted-foreground">{open.scene}</p>
              <div className="flex shrink-0 gap-2">
                {open.url ? (
                  <button
                    type="button"
                    onClick={() => downloadClip(open.id)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground"
                  >
                    <Download className="size-3.5" />
                    Télécharger le rendu
                  </button>
                ) : null}
                <button onClick={() => setOpen(null)} className="rounded-full px-3 py-1 text-xs text-foreground ring-1 ring-white/10">
                  Fermer
                </button>
              </div>
            </div>
            <div className={`mx-auto max-h-[70vh] w-full overflow-hidden rounded-[10px] ${FORMATS.find((f) => f.id === open.format)?.boxClass ?? "aspect-video"}`} style={{ maxWidth: "min(100%, 70vh * 1.78)" }}>
              <video src={open.url ?? undefined} controls autoPlay playsInline className="size-full object-cover" />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <section className="rounded-[10px] bg-paper p-3 ring-1 ring-white/5">
                <h3 className="flex items-center gap-1.5 text-xs font-medium">
                  <Wand2 className="size-3.5 text-primary" /> Re-styliser cette scène
                </h3>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Relance le même prompt dans un autre style visuel.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {STYLE_PRESETS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => restyleAs(open, s.id)}
                      disabled={busy !== null}
                      className="rounded-full px-2.5 py-1 text-[11px] ring-1 ring-white/10 hover:bg-white/5 disabled:opacity-50"
                    >
                      {busy === `style-${s.id}` ? "Lancement…" : s.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[10px] bg-paper p-3 ring-1 ring-white/5">
                <h3 className="flex items-center gap-1.5 text-xs font-medium">
                  <Music4 className="size-3.5 text-primary" /> Musique & ambiance IA
                </h3>
                {open.music_brief ? (
                  <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-muted-foreground">
                    {open.music_brief}
                  </p>
                ) : (
                  <>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Une direction musicale et sonore écrite pour cette scène.
                    </p>
                    <button
                      onClick={() => makeMusicBrief(open)}
                      disabled={busy !== null}
                      className="mt-2 rounded-full bg-primary px-3 py-1 text-[11px] text-primary-foreground disabled:opacity-50"
                    >
                      {busy === "music" ? "Composition…" : "Générer la direction"}
                    </button>
                  </>
                )}
              </section>

              <section className="rounded-[10px] bg-paper p-3 ring-1 ring-white/5">
                <h3 className="flex items-center gap-1.5 text-xs font-medium">
                  <Share2 className="size-3.5 text-primary" /> Export réseaux sociaux
                </h3>
                <div className="mt-2 space-y-1.5">
                  {SOCIAL_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => downloadClip(open.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left ring-1 ring-white/5 hover:bg-white/5"
                    >
                      <span>
                        <span className="block text-[11px] font-medium">{p.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{p.tip}</span>
                      </span>
                      <Download className="size-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <section className="rounded-[10px] bg-paper p-3 ring-1 ring-white/5">
                <h3 className="flex items-center gap-1.5 text-xs font-medium">
                  <FolderPlus className="size-3.5 text-primary" /> Projet
                </h3>
                <select
                  value={open.project_id ?? ""}
                  onChange={async (e) => {
                    const projectId = e.target.value || null;
                    await moveClip({ data: { clipId: open.id, projectId } });
                    patchClip(open.id, { project_id: projectId });
                  }}
                  className="mt-2 w-full rounded-md bg-background px-2 py-1.5 text-xs ring-1 ring-white/10"
                >
                  <option value="">Sans projet</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </section>
              <section className="rounded-[10px] bg-paper p-3 ring-1 ring-white/5">
                <h3 className="flex items-center gap-1.5 text-xs font-medium">
                  <Link2 className="size-3.5 text-primary" /> Page de partage publique
                </h3>
                {open.share_token ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <input readOnly value={shareUrl(open.share_token)} className="min-w-0 flex-1 rounded-md bg-background px-2 py-1.5 font-mono text-[10px] ring-1 ring-white/10" />
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(shareUrl(open.share_token!));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 text-[11px] text-primary-foreground"
                      >
                        <Copy className="size-3" /> {copied ? "Copié" : "Copier"}
                      </button>
                    </div>
                    <button onClick={() => toggleShare(open, false)} disabled={busy !== null} className="text-[11px] text-muted-foreground hover:text-destructive">
                      Désactiver le lien
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mt-1 text-[11px] text-muted-foreground">Toute personne ayant le lien pourra regarder ce clip.</p>
                    <button onClick={() => toggleShare(open, true)} disabled={busy !== null} className="mt-2 rounded-full bg-primary px-3 py-1 text-[11px] text-primary-foreground disabled:opacity-50">
                      {busy === "share" ? "Création…" : "Créer un lien public"}
                    </button>
                  </>
                )}
              </section>
            </div>
            {notice ? <p className="mt-3 text-xs text-muted-foreground">{notice}</p> : null}
          </div>
        ) : null}

        {downloadError ? <p className="mt-3 text-sm text-destructive">{downloadError}</p> : null}

        {isLoading ? (
          <p className="mt-10 text-sm text-muted-foreground">Chargement…</p>
        ) : shown.length === 0 ? (
          <div className="mt-8 rounded-[14px] bg-paper p-10 text-center ring-1 ring-white/5">
            <p className="text-sm text-muted-foreground">Aucun clip ici pour l'instant.</p>
            <Link to="/studio" className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
              Ouvrir le studio
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {shown.map((c) => (
              <div key={c.id} className="rise overflow-hidden rounded-[12px] bg-paper ring-1 ring-white/5">
                <button onClick={() => c.url && setOpen(c)} className="block w-full">
                  <div className="aspect-video w-full bg-muted-foreground/25">
                    {c.url ? (
                      <video src={c.url} muted playsInline preload="metadata" className="size-full object-cover" />
                    ) : (
                      <div className="grid size-full place-items-center font-mono text-[10px] uppercase text-muted-foreground/60">
                        {c.status === "pending" ? "Rendu en cours" : "Échec"}
                      </div>
                    )}
                  </div>
                </button>
                <div className="p-3">
                  <p className="line-clamp-2 text-sm font-medium">{c.scene}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      {c.format} · {c.resolution} · {c.duration}s · {new Date(c.created_at).toLocaleDateString("fr-FR")}
                    </span>
                    <button
                      onClick={async () => {
                        await del({ data: { id: c.id } });
                        qc.setQueryData<ClipRow[]>(["clips"], (p = []) => p.filter((x) => x.id !== c.id));
                        if (open?.id === c.id) setOpen(null);
                      }}
                      className="text-[11px] text-muted-foreground hover:text-destructive"
                    >
                      Supprimer
                    </button>
                  </div>
                  {c.error ? <p className="mt-1 text-[11px] text-destructive">{c.error}</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
    </main>
  );
}
