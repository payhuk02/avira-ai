import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Play, Trash2 } from "lucide-react";
import { adminClipUrl, adminDeleteClip, adminListClips } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/videos")({ component: VideosPage });

const STATUSES = [
  { id: "all", label: "Tous" },
  { id: "done", label: "Réussis" },
  { id: "pending", label: "En cours" },
  { id: "failed", label: "Échoués" },
];

function VideosPage() {
  const list = useServerFn(adminListClips);
  const getUrl = useServerFn(adminClipUrl);
  const del = useServerFn(adminDeleteClip);
  const qc = useQueryClient();
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "clips"], queryFn: () => list() });
  const rm = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Clip supprimé"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const open = async (id: string, download = false) => {
    try {
      const { url } = await getUrl({ data: { id, download } });
      if (download) window.location.href = url;
      else setPlaying({ id, url });
    } catch (e) { toast.error((e as Error).message); }
  };
  const rows = data.filter(
    (c) => (status === "all" || c.status === status) &&
      (c.email.toLowerCase().includes(q.toLowerCase()) || c.scene.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Button key={s.id} size="sm" variant={status === s.id ? "default" : "outline"} onClick={() => setStatus(s.id)}>{s.label}</Button>
        ))}
        <Input placeholder="Utilisateur ou scène…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto max-w-xs" />
      </div>
      {playing && (
        <div className="rounded-lg border border-border bg-card p-3">
          <video src={playing.url} controls autoPlay className="mx-auto max-h-[60vh] rounded-md" />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setPlaying(null)}>Fermer</Button>
        </div>
      )}
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <div key={c.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{c.email}</span>
                <Badge variant={c.status === "failed" ? "destructive" : c.status === "done" ? "default" : "outline"}>{c.status}</Badge>
              </div>
              <p className="line-clamp-3 text-sm">{c.scene}</p>
              <p className="font-mono text-[10px] uppercase text-muted-foreground">
                {c.format} · {c.resolution} · {c.duration}s · {new Date(c.created_at).toLocaleString("fr-FR")}
              </p>
              {c.error && <p className="text-xs text-destructive">{c.error}</p>}
              <div className="mt-auto flex gap-1 pt-2">
                {c.storage_path && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => open(c.id)}><Play /> Lire</Button>
                    <Button size="sm" variant="outline" onClick={() => open(c.id, true)}><Download /></Button>
                  </>
                )}
                <Button size="sm" variant="ghost" className="ml-auto text-destructive"
                  onClick={() => confirm("Supprimer ce clip ?") && rm.mutate(c.id)}><Trash2 /></Button>
              </div>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-muted-foreground">Aucun clip.</p>}
        </div>
      )}
    </div>
  );
}
