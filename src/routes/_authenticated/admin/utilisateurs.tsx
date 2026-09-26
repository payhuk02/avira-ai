import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminListUsers, adminUserAction } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/utilisateurs")({ component: UsersPage });

type Action = "ban" | "unban" | "delete" | "grantAdmin" | "revokeAdmin";
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR") : "—");

function UsersPage() {
  const list = useServerFn(adminListUsers);
  const act = useServerFn(adminUserAction);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "users"], queryFn: () => list() });
  const m = useMutation({
    mutationFn: (v: { userId: string; action: Action }) => act({ data: v }),
    onSuccess: () => {
      toast.success("Action effectuée");
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const run = (userId: string, action: Action, confirmText?: string) => {
    if (confirmText && !confirm(confirmText)) return;
    m.mutate({ userId, action });
  };
  const rows = data.filter((u) => u.email.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <Input placeholder="Rechercher un e-mail…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left font-mono text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="p-3">E-mail</th><th className="p-3">Inscrit</th><th className="p-3">Dernière connexion</th>
                <th className="p-3">Clips</th><th className="p-3">Statut</th><th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-medium">{u.email}</td>
                  <td className="p-3">{fmt(u.created_at)}</td>
                  <td className="p-3">{fmt(u.last_sign_in_at)}</td>
                  <td className="p-3">{u.clips}</td>
                  <td className="space-x-1 p-3">
                    {u.isAdmin && <Badge>Admin</Badge>}
                    {u.banned ? <Badge variant="destructive">Suspendu</Badge> : <Badge variant="outline">Actif</Badge>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {u.isAdmin ? (
                        <Button size="sm" variant="outline" onClick={() => run(u.id, "revokeAdmin")}>Retirer admin</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => run(u.id, "grantAdmin", `Donner les droits admin à ${u.email} ?`)}>Rendre admin</Button>
                      )}
                      {u.banned ? (
                        <Button size="sm" variant="outline" onClick={() => run(u.id, "unban")}>Réactiver</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => run(u.id, "ban", `Suspendre ${u.email} ?`)}>Suspendre</Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => run(u.id, "delete", `Supprimer définitivement ${u.email} et toutes ses vidéos ?`)}>Supprimer</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
