import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { adminDeleteStoryboard, adminListStoryboards } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/storyboards")({ component: BoardsPage });

function BoardsPage() {
  const list = useServerFn(adminListStoryboards);
  const del = useServerFn(adminDeleteStoryboard);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "boards"], queryFn: () => list() });
  const rm = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Storyboard supprimé"); qc.invalidateQueries({ queryKey: ["admin"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const rows = data.filter((b) => (b.title + b.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Input placeholder="Titre ou utilisateur…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(open === b.id ? null : b.id)}>
                  <p className="font-display text-lg">{b.title}</p>
                  <p className="text-sm text-muted-foreground">{b.logline}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">
                    {b.email} · {b.format} · {b.scenes.length} scènes · {new Date(b.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </button>
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => confirm("Supprimer ce storyboard ?") && rm.mutate(b.id)}><Trash2 /></Button>
              </div>
              {open === b.id && (
                <ol className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                  <li className="text-muted-foreground">Idée : {b.idea}</li>
                  {b.scenes.map((s, i) => (
                    <li key={i}><span className="font-mono text-xs">#{i + 1} · {s.duration}s</span> — {s.action ?? s.shot}</li>
                  ))}
                </ol>
              )}
            </div>
          ))}
          {!rows.length && <p className="text-sm text-muted-foreground">Aucun storyboard.</p>}
        </div>
      )}
    </div>
  );
}
