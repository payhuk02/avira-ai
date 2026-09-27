import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminAuditLog, adminGenerationEvents } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/journal")({ component: AuditPage });

const CATS = [
  { id: "all", label: "Tout" },
  { id: "api_key", label: "Clés API" },
  { id: "user", label: "Comptes" },
  { id: "settings", label: "Paramètres" },
  { id: "content", label: "Contenus" },
];
const ACTIONS: Record<string, string> = {
  update_key: "Clé modifiée", reset_key: "Clé réinitialisée", ban: "Compte suspendu", unban: "Compte réactivé",
  delete: "Compte supprimé", grantAdmin: "Droits admin accordés", revokeAdmin: "Droits admin retirés",
  update_settings: "Paramètres modifiés", delete_clip: "Clip supprimé", delete_storyboard: "Storyboard supprimé",
};

function AuditPage() {
  const [tab, setTab] = useState<"audit" | "generation">("audit");
  const fn = useServerFn(adminAuditLog);
  const genFn = useServerFn(adminGenerationEvents);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin", "audit", q, category],
    queryFn: () => fn({ data: { q: q || undefined, category } }),
    enabled: tab === "audit",
  });
  const { data: gen = [], isLoading: genLoading } = useQuery({
    queryKey: ["admin", "generation-events"],
    queryFn: () => genFn(),
    enabled: tab === "generation",
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === "audit" ? "default" : "outline"} onClick={() => setTab("audit")}>
          Audit admin
        </Button>
        <Button size="sm" variant={tab === "generation" ? "default" : "outline"} onClick={() => setTab("generation")}>
          Cascade vidéo
        </Button>
      </div>

      {tab === "audit" ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {CATS.map((c) => (
              <Button key={c.id} size="sm" variant={category === c.id ? "default" : "outline"} onClick={() => setCategory(c.id)}>{c.label}</Button>
            ))}
            <Input placeholder="Admin, action ou cible…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto max-w-xs" />
          </div>
          {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground">
                  <tr><th className="p-3">Date</th><th className="p-3">Administrateur</th><th className="p-3">Action</th><th className="p-3">Cible</th><th className="p-3">Détails</th></tr>
                </thead>
                <tbody>
                  {data.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 align-top last:border-0">
                      <td className="whitespace-nowrap p-3">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                      <td className="p-3">{r.actor_email || "—"}</td>
                      <td className="p-3"><Badge variant="outline">{ACTIONS[r.action] ?? r.action}</Badge></td>
                      <td className="p-3 font-mono text-xs">{r.target}</td>
                      <td className="max-w-xs break-all p-3 font-mono text-[11px] text-muted-foreground">{r.details === "{}" ? "" : r.details}</td>
                    </tr>
                  ))}
                  {!data.length && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Aucune entrée.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : genLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Résultat</th>
                <th className="p-3">HTTP</th>
                <th className="p-3">Latence</th>
                <th className="p-3">Erreur</th>
              </tr>
            </thead>
            <tbody>
              {gen.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top last:border-0">
                  <td className="whitespace-nowrap p-3">{new Date(r.created_at).toLocaleString("fr-FR")}</td>
                  <td className="p-3">{r.provider}{r.model ? ` · ${r.model}` : ""}</td>
                  <td className="p-3">
                    <Badge variant={r.outcome === "ok" ? "default" : "outline"}>{r.outcome}</Badge>
                  </td>
                  <td className="p-3 font-mono text-xs">{r.http_status ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</td>
                  <td className="max-w-xs break-all p-3 font-mono text-[11px] text-muted-foreground">{r.error ?? ""}</td>
                </tr>
              ))}
              {!gen.length && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Aucun événement (appliquez la migration generation_events si besoin).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
