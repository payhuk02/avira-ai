import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { adminUsage } from "@/lib/admin.functions";
import { StatCard } from "@/components/AdminShell";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/admin/couts")({ component: UsagePage });

const n = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function UsagePage() {
  const fn = useServerFn(adminUsage);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin", "usage"], queryFn: () => fn() });
  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (error || !data) return <p className="text-sm text-destructive">{(error as Error)?.message}</p>;
  const total = data.providers.reduce((s, p) => s + p.requests, 0);
  const failed = data.providers.reduce((s, p) => s + p.failed, 0);
  const maxCost = Math.max(0.0001, ...data.days.map((d) => d.cost));

  return (
    <div className="space-y-6">
      {data.alert && (
        <div className={`flex items-start gap-3 rounded-lg border p-4 ${data.alert === "exceeded" ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10"}`}>
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">
              {data.alert === "exceeded" ? "Budget mensuel dépassé" : `Seuil d'alerte atteint (${data.budget.alertThreshold} %)`}
            </p>
            <p className="text-muted-foreground">
              {n(data.monthCost)} crédits estimés sur {n(data.budget.monthlyBudget)} ce mois-ci. Vous pouvez suspendre la génération dans les{" "}
              <Link to="/admin/parametres" className="underline">paramètres</Link>.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Requêtes IA · 30 j" value={total} />
        <StatCard label="Taux d'échec" value={`${total ? n((failed / total) * 100) : 0} %`} hint={`${failed} échecs`} />
        <StatCard label="Coût estimé · mois" value={n(data.monthCost)} hint="crédits" />
        <StatCard label="Créateurs actifs · 30 j" value={data.activeUsers30d} />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between text-sm">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Budget mensuel</p>
          <span>{data.budget.monthlyBudget > 0 ? `${n(data.budgetPct)} %` : "Non défini"}</span>
        </div>
        <Progress value={Math.min(100, data.budgetPct)} className="mt-3" />
        {data.budget.monthlyBudget === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Définissez un budget et un seuil dans les <Link to="/admin/parametres" className="underline">paramètres</Link> pour activer les alertes.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground">
            <tr><th className="p-3">Fournisseur</th><th className="p-3">Modèle</th><th className="p-3">Usage</th><th className="p-3">Requêtes</th><th className="p-3">Échecs</th><th className="p-3">Coût 30 j</th><th className="p-3">Coût mois</th></tr>
          </thead>
          <tbody>
            {data.providers.map((p) => (
              <tr key={p.kind} className="border-b border-border/60 last:border-0">
                <td className="p-3 font-medium capitalize">{p.provider}</td>
                <td className="p-3 font-mono text-xs">{p.model}</td>
                <td className="p-3">{p.kind}</td>
                <td className="p-3">{p.requests}</td>
                <td className="p-3">{p.failed}</td>
                <td className="p-3">{n(p.cost30d)}</td>
                <td className="p-3">{n(p.costMonth)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase text-muted-foreground">Coût estimé par jour · 30 jours</p>
        <div className="mt-6 flex h-40 items-end gap-1">
          {data.days.map((d) => (
            <div key={d.day} title={`${d.day} · ${n(d.cost)} crédits · ${d.clips} clips (${d.failed} échecs) · ${d.storyboards} storyboards`}
              className="flex-1 rounded-t-sm bg-primary" style={{ height: `${(d.cost / maxCost) * 100}%`, minHeight: 2 }} />
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <p className="font-mono text-[10px] uppercase text-muted-foreground">Principales causes d'échec</p>
        {data.topErrors.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {data.topErrors.map((e) => (
              <li key={e.message} className="flex gap-3"><span className="font-mono">{e.count}×</span><span>{e.message}</span></li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-muted-foreground">Aucun échec sur 30 jours.</p>}
      </div>
      <p className="text-xs text-muted-foreground">Coûts estimés à partir des tarifs définis dans les paramètres ; ils ne remplacent pas la facturation réelle.</p>
    </div>
  );
}
