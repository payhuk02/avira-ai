import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FORMATS, type FormatId } from "@/lib/studio";
import {
  deleteStoryboard,
  generateStoryboard,
  listStoryboards,
  type StoryboardRow,
} from "@/lib/storyboard.functions";

export const Route = createFileRoute("/_authenticated/storyboard")({
  head: () => ({
    meta: [
      { title: "Storyboard IA — Avira ai" },
      { name: "description", content: "Décrivez votre idée, obtenez un storyboard détaillé avec des scènes prêtes à produire." },
      { property: "og:title", content: "Storyboard IA — Avira ai" },
      { property: "og:description", content: "De l'idée au découpage technique, scène par scène." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StoryboardPage,
});

const TONES = ["Cinématographique", "Publicitaire", "Documentaire", "Émotion intime", "Énergique"];

function StoryboardPage() {
  const qc = useQueryClient();
  const gen = useServerFn(generateStoryboard);
  const list = useServerFn(listStoryboards);
  const del = useServerFn(deleteStoryboard);
  const { data: boards = [] } = useQuery({ queryKey: ["storyboards"], queryFn: () => list() });
  const [idea, setIdea] = useState("");
  const [format, setFormat] = useState<FormatId>("16:9");
  const [tone, setTone] = useState(TONES[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const { user } = useAuth();
  const navigate = useNavigate();
  const [sent, setSent] = useState(false);
  function sendAll(board: StoryboardRow) {
    if (!user) return;
    const conf = FORMATS.find((f) => f.id === board.format) ?? FORMATS[0]!;
    const key = `avira-cart-${user.id}`;
    let cart: unknown[] = [];
    try { cart = JSON.parse(localStorage.getItem(key) ?? "[]"); } catch {}
    const items = board.scenes.map((sc) => {
      const duration = Math.min(10, Math.max(5, sc.duration));
      const scene = `${board.title} — ${sc.number}. ${sc.title}`.slice(0, 2000);
      return {
        id: crypto.randomUUID(), scene, priority: "normal", format: conf.id, resolution: "720p", duration,
        shots: [{ scene, prompt: sc.prompt.slice(0, 4000), format: conf.id, aspect: conf.base, resolution: "720p", duration }],
        createdAt: Date.now(),
      };
    });
    localStorage.setItem(key, JSON.stringify([...cart, ...items]));
    setSent(true);
    navigate({ to: "/studio" });
  }

  const active = boards.find((b) => b.id === activeId) ?? boards[0] ?? null;

  async function run() {
    if (idea.trim().length < 10 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await gen({ data: { idea: idea.trim(), format, tone } });
      if (r.error || !r.board) throw new Error(r.error ?? "Échec.");
      qc.setQueryData<StoryboardRow[]>(["storyboards"], (prev = []) => [r.board!, ...prev]);
      setActiveId(r.board.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className="rise space-y-5">
            <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
              <h1 className="font-display text-3xl leading-tight">Salle d'écriture</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Décrivez votre idée : l'IA la découpe en scènes prêtes à tourner.
              </p>
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                rows={6}
                placeholder="Ex. : Un spot de 30 secondes pour une marque de café ivoirienne, une jeune femme à la peau foncée ouvre son atelier à l'aube à Abidjan…"
                className="mt-4 w-full resize-none rounded-[10px] bg-background p-4 text-sm leading-relaxed outline-none ring-1 ring-white/5 placeholder:text-muted-foreground/50 focus:ring-primary"
              />
              <p className="mb-1.5 mt-4 text-[11px] font-medium text-muted-foreground">Format</p>
              <div className="flex flex-wrap gap-1.5">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      format === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground ring-1 ring-white/5 hover:bg-white/5"
                    }`}
                  >
                    {f.id}
                  </button>
                ))}
              </div>
              <p className="mb-1.5 mt-4 text-[11px] font-medium text-muted-foreground">Ton</p>
              <div className="flex flex-wrap gap-1.5">
                {TONES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      tone === t ? "bg-primary text-primary-foreground" : "text-muted-foreground ring-1 ring-white/5 hover:bg-white/5"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={run}
                disabled={busy || idea.trim().length < 10}
                className="mt-5 w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-50"
              >
                {busy ? "Écriture du storyboard… (~30 s)" : "Générer le storyboard"}
              </button>
              {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
            </div>

            {boards.length > 0 ? (
              <div className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
                <h2 className="font-display text-xl">Mes storyboards</h2>
                <ul className="mt-3 space-y-1">
                  {boards.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => setActiveId(b.id)}
                        className={`w-full rounded-[8px] px-3 py-2 text-left text-sm ${
                          active?.id === b.id ? "bg-primary text-primary-foreground" : "hover:bg-white/5"
                        }`}
                      >
                        <span className="block truncate font-medium">{b.title}</span>
                        <span className="font-mono text-[10px] opacity-60">
                          {b.scenes.length} scènes · {b.format}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>

          <section className="rise2">
            {busy && !active ? (
              <Placeholder text="Le réalisateur écrit votre découpage…" />
            ) : active ? (
              <div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                      Storyboard · {active.format} · {active.scenes.reduce((s, x) => s + x.duration, 0)}s
                    </p>
                    <h2 className="mt-1 font-display text-3xl leading-tight sm:text-4xl">{active.title}</h2>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{active.logline}</p>
                    <button type="button" disabled={!user || sent} onClick={() => sendAll(active)}
                      className="mt-4 inline-flex rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">
                      Envoyer les {active.scenes.length} scènes au panier du studio →
                    </button>
                  </div>
                  <button
                    onClick={async () => {
                      await del({ data: { id: active.id } });
                      qc.setQueryData<StoryboardRow[]>(["storyboards"], (p = []) => p.filter((b) => b.id !== active.id));
                      setActiveId(null);
                    }}
                    className="rounded-full px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-white/10 hover:bg-white/5"
                  >
                    Supprimer
                  </button>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {active.scenes.map((s) => (
                    <article key={s.number} className="rounded-[14px] bg-paper p-5 ring-1 ring-white/5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary-deep">
                          Scène {String(s.number).padStart(2, "0")} · {s.duration}s
                        </span>
                        <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-muted-foreground">
                          {s.shot}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-xl">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed">{s.action}</p>
                      <dl className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                        <Field k="Caméra" v={s.camera} />
                        <Field k="Lumière" v={s.lighting} />
                        <Field k="Son" v={s.audio} />
                      </dl>
                      <details className="mt-4">
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Prompt de production
                        </summary>
                        <p className="mt-2 rounded-[8px] bg-background p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                          {s.prompt}
                        </p>
                      </details>
                      <Link
                        to="/studio"
                        search={{ scene: s.prompt, format: active.format, duration: s.duration }}
                        className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-medium text-black hover:bg-primary-deep hover:text-white"
                      >
                        Produire cette scène →
                      </Link>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <Placeholder text="Votre storyboard apparaîtra ici, scène par scène." />
            )}
          </section>
        </div>
    </main>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-[8px] bg-background p-2.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">{k}</dt>
      <dd className="mt-1 leading-snug">{v}</dd>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="grid min-h-[360px] place-items-center rounded-[14px] bg-paper p-8 text-center ring-1 ring-white/5">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
