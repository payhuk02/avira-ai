import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { adminClipUrl, adminListClips } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/scenes")({ component: ScenesPage });

const STATUS: Record<string, { label: string; variant: "default" | "outline" | "destructive" }> = {
  pending: { label: "En cours", variant: "outline" },
  done: { label: "Terminé", variant: "default" },
  failed: { label: "Échoué", variant: "destructive" },
};

function ScenesPage() {
  const list = useServerFn(adminListClips);
  const getUrl = useServerFn(adminClipUrl);
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "clips"], queryFn: () => list(), refetchInterval: 15000 });

  const groups = useMemo(() => {
    const map = new Map<string, typeof data>();
    for (const c of data) {
      if (q && !(c.email + " " + c.scene).toLowerCase().includes(q.toLowerCase())) continue;
      map.set(c.email, [...(map.get(c.email) ?? []), c]);
    }
    return [...map.entries()];
  }, [data, q]);

  const openRender = async (id: string) => {
    const win = window.open("", "_blank");
    try {
      const { url } = await getUrl({ data: { id } });
      if (win) win.location.href = url; else window.location.href = url;
    } catch (e) {
      win?.close();
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <Input placeholder="Utilisateur ou scène…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : groups.map(([email, clips]) => {
        const count = (s: string) => clips.filter((c) => c.status === s).length;
        return (
          <section key={email} className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="flex flex-wrap items-center gap-3 border-b border-border bg-muted/40 px-4 py-3">
              <p className="flex-1 font-medium">{email}</p>
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                {clips.length} scènes · {count("done")} terminées · {count("pending")} en cours · {count("failed")} échouées
              </span>
            </header>
            <ul>
              {clips.map((c) => {
                const st = STATUS[c.status] ?? { label: c.status, variant: "outline" as const };
                return (
                  <li key={c.id} className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{c.scene}</p>
                      <p className="font-mono text-[10px] uppercase text-muted-foreground">
                        {c.format} · {c.resolution} · {c.duration}s · {new Date(c.created_at).toLocaleString("fr-FR")}
                      </p>
                      {c.error && <p className="text-xs text-destructive">{c.error}</p>}
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                    {c.storage_path ? (
                      <Button size="sm" variant="outline" onClick={() => openRender(c.id)}><ExternalLink /> Voir le rendu</Button>
                    ) : (
                      <span className="w-[118px] text-center text-xs text-muted-foreground">—</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {!isLoading && !groups.length && <p className="text-sm text-muted-foreground">Aucune scène.</p>}
    </div>
  );
}
