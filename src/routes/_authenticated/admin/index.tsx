import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminOverview } from "@/lib/admin.functions";
import { StatCard } from "@/components/AdminShell";

export const Route = createFileRoute("/_authenticated/admin/")({ component: Overview });

function Overview() {
  const fn = useServerFn(adminOverview);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "overview"], queryFn: () => fn() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message}</p>;
  const max = Math.max(1, ...data.days.map((d) => d.clips));
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Utilisateurs" value={data.users} />
        <StatCard label="Clips générés" value={data.clips} hint={`${data.done} réussis · ${data.pending} en cours · ${data.failed} échoués`} />
        <StatCard label="Storyboards" value={data.storyboards} />
        <StatCard label="Minutes produites" value={(data.seconds / 60).toFixed(1)} />
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase text-muted-foreground">Activité — 7 derniers jours</p>
        <div className="mt-6 flex h-48 items-end gap-3">
          {data.days.map((d) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs text-muted-foreground">{d.clips}</span>
              <div className="w-full rounded-t-md bg-primary" style={{ height: `${(d.clips / max) * 100}%`, minHeight: 4 }} />
              <span className="font-mono text-[10px] text-muted-foreground">
                {new Date(d.day).toLocaleDateString("fr-FR", { weekday: "short" })}
              </span>
              <span className="text-[10px] text-muted-foreground">+{d.users} inscr.</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
