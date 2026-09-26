import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { GitCompareArrows, Play, Trophy } from "lucide-react";
import { listClips, type ClipRow } from "@/lib/clips.functions";

export const Route = createFileRoute("/_authenticated/comparaison")({
  head: () => ({
    meta: [
      { title: "Comparateur A/B — Avira ai" },
      { name: "description", content: "Comparez deux versions d'une même scène côte à côte et choisissez la meilleure." },
      { property: "og:title", content: "Comparateur A/B — Avira ai" },
      { property: "og:description", content: "Deux rendus face à face, un seul gagnant." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Compare,
});

const VOTES_KEY = "avira-ab-votes";

function loadVotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(VOTES_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function Compare() {
  const list = useServerFn(listClips);
  const { data: clips = [] } = useQuery({ queryKey: ["clips"], queryFn: () => list() });
  const done = clips.filter((c) => c.status === "done" && c.url);
  const [aId, setAId] = useState<string>("");
  const [bId, setBId] = useState<string>("");
  const [votes, setVotes] = useState<Record<string, string>>({});
  const aRef = useRef<HTMLVideoElement>(null);
  const bRef = useRef<HTMLVideoElement>(null);

  useEffect(() => setVotes(loadVotes()), []);
  useEffect(() => {
    if (!aId && done[0]) setAId(done[0].id);
    if (!bId && done[1]) setBId(done[1].id);
  }, [done, aId, bId]);

  const a = done.find((c) => c.id === aId) ?? null;
  const b = done.find((c) => c.id === bId) ?? null;
  const pairKey = a && b ? [a.id, b.id].sort().join("|") : null;
  const winner = pairKey ? votes[pairKey] : undefined;

  function playBoth() {
    aRef.current?.play();
    bRef.current?.play();
  }

  function vote(id: string) {
    if (!pairKey) return;
    const next = { ...votes, [pairKey]: id };
    setVotes(next);
    localStorage.setItem(VOTES_KEY, JSON.stringify(next));
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Comparateur A/B</h1>
          <p className="text-sm text-muted-foreground">
            Deux rendus face à face. Écoutez votre œil, puis couronnez le gagnant.
          </p>
        </div>
        {a && b ? (
          <button
            onClick={playBoth}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            <Play className="size-4" /> Lecture synchronisée
          </button>
        ) : null}
      </div>

      {done.length < 2 ? (
        <div className="mt-8 rounded-[14px] bg-paper p-10 text-center ring-1 ring-white/5">
          <GitCompareArrows className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Il faut au moins deux clips terminés pour comparer. Générez des variantes depuis le studio.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {([["A", a, setAId, aRef], ["B", b, setBId, bRef]] as const).map(([label, clip, setId, ref]) => (
            <div key={label} className="overflow-hidden rounded-[14px] bg-card ring-1 ring-white/10">
              <div className="flex items-center gap-2 border-b border-white/5 p-3">
                <span className="grid size-7 place-items-center rounded-md bg-primary font-display text-sm text-primary-foreground">
                  {label}
                </span>
                <select
                  value={clip?.id ?? ""}
                  onChange={(e) => setId(e.target.value)}
                  className="min-w-0 flex-1 rounded-md bg-paper px-2 py-1.5 text-xs ring-1 ring-white/10 outline-none"
                >
                  {done.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.scene.slice(0, 60)} · {c.format} · {c.duration}s
                    </option>
                  ))}
                </select>
              </div>
              <div className="aspect-video bg-black">
                {clip?.url ? (
                  <video ref={ref} src={clip.url} controls playsInline className="size-full object-contain" />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-2 p-3">
                <p className="min-w-0 truncate text-xs text-muted-foreground">{clip?.scene}</p>
                <button
                  onClick={() => clip && vote(clip.id)}
                  disabled={!clip || winner === clip?.id}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                    winner === clip?.id
                      ? "bg-primary text-primary-foreground"
                      : "ring-1 ring-white/10 hover:bg-white/5"
                  }`}
                >
                  <Trophy className="size-3.5" />
                  {winner === clip?.id ? "Gagnant" : "Choisir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {Object.keys(votes).length > 0 ? (
        <p className="mt-6 text-center font-mono text-[10px] uppercase text-muted-foreground/60">
          {Object.keys(votes).length} duel{Object.keys(votes).length > 1 ? "s" : ""} arbitré
          {Object.keys(votes).length > 1 ? "s" : ""} sur cet appareil
        </p>
      ) : null}
    </main>
  );
}
