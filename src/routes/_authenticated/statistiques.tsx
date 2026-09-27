import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Clock3, Coins, Film, XCircle } from "lucide-react";
import { myStats } from "@/lib/clips.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/statistiques")({
  head: () => ({
    meta: [
      { title: `Mes statistiques — ${BRAND}` },
      { name: "description", content: "Suivez vos générations : réussites, échecs, temps produit et coût estimé." },
      { property: "og:title", content: `Mes statistiques — ${BRAND}` },
      { property: "og:description", content: "Votre activité de génération vidéo en chiffres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Stats,
});

function Stats() {
  const fetchStats = useServerFn(myStats);
  const { data: s, isLoading } = useQuery({ queryKey: ["my-stats"], queryFn: () => fetchStats() });

  if (isLoading || !s) {
    return (
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <p className="mt-10 text-sm text-muted-foreground">Chargement…</p>
      </main>
    );
  }

  const maxDay = Math.max(1, ...s.byDay.map((d) => d.count));
  const cards = [
    { icon: Film, label: "Clips générés", value: String(s.total) },
    { icon: CheckCircle2, label: "Taux de réussite", value: `${s.successRate} %` },
    { icon: Clock3, label: "Temps produit", value: `${s.totalSeconds} s` },
    { icon: Coins, label: "Coût estimé", value: `${s.estimatedCost.toFixed(2)} €` },
  ];

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Mes statistiques</h1>
        <p className="text-sm text-muted-foreground">
          Votre activité de génération en un coup d'œil. Le coût est une estimation (
          {s.costPerSecond.toFixed(2)} €/seconde, config admin).
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-[14px] bg-card p-4 ring-1 ring-white/10">
            <c.icon className="size-5 text-primary" />
            <p className="mt-3 font-display text-2xl sm:text-3xl">{c.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[14px] bg-card p-4 ring-1 ring-white/10 lg:col-span-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-primary" />
            <h2 className="text-sm font-medium">Générations des 14 derniers jours</h2>
          </div>
          {s.byDay.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Aucune génération pour l'instant.</p>
          ) : (
            <div className="mt-4 flex h-36 items-end gap-1.5">
              {s.byDay.map((d) => (
                <div key={d.day} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="font-mono text-[9px] text-muted-foreground/0 transition group-hover:text-muted-foreground">
                    {d.count}
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/80 transition group-hover:bg-primary"
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                  />
                  <span className="font-mono text-[8px] text-muted-foreground/60">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-[14px] bg-card p-4 ring-1 ring-white/10">
            <h2 className="text-sm font-medium">Statuts</h2>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle2 className="size-3.5 text-primary" /> Terminés
                </dt>
                <dd className="font-mono">{s.done}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock3 className="size-3.5" /> En cours
                </dt>
                <dd className="font-mono">{s.pending}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <XCircle className="size-3.5 text-destructive" /> Échoués
                </dt>
                <dd className="font-mono">{s.failed}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[14px] bg-card p-4 ring-1 ring-white/10">
            <h2 className="text-sm font-medium">Formats favoris</h2>
            {s.byFormat.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">—</p>
            ) : (
              <dl className="mt-3 space-y-2 text-xs">
                {s.byFormat.map((f) => (
                  <div key={f.format} className="flex items-center justify-between">
                    <dt className="font-mono text-muted-foreground">{f.format}</dt>
                    <dd className="font-mono">{f.count}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {s.topStyles.length > 0 ? (
            <div className="rounded-[14px] bg-card p-4 ring-1 ring-white/10">
              <h2 className="text-sm font-medium">Styles utilisés</h2>
              <dl className="mt-3 space-y-2 text-xs">
                {s.topStyles.map((st) => (
                  <div key={st.style} className="flex items-center justify-between">
                    <dt className="capitalize text-muted-foreground">{st.style}</dt>
                    <dd className="font-mono">{st.count}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
