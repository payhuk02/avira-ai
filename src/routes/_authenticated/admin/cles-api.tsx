import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { adminListKeys, adminSetKey, adminTestKey, adminGetOpenRouterPool, adminSaveOpenRouterPool, adminTestOpenRouterPool } from "@/lib/admin.functions";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/cles-api")({ component: KeysPage });

const SOURCE = { custom: "Clé personnalisée", default: "Clé par défaut", missing: "Non configurée" } as const;

function KeysPage() {
  const list = useServerFn(adminListKeys);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "keys"], queryFn: () => list() });
  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        Les clés sont stockées côté serveur et ne sont jamais renvoyées au navigateur : seules les 4 premières et
        dernières lettres s'affichent.
      </p>
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : data.map((k) => <KeyCard key={k.name} k={k} />)}
      <OpenRouterPool />
    </div>
  );
}

function KeyCard({ k }: { k: { name: "LOVABLE_API_KEY" | "OPENAI_API_KEY" | "OPENROUTER_API_KEY" | "RUNWAY_API_KEY" | "GOOGLE_API_KEY"; label: string; usage: string; source: keyof typeof SOURCE; masked: string | null; updated_at: string | null } }) {
  const save = useServerFn(adminSetKey);
  const test = useServerFn(adminTestKey);
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const wrap = async (f: () => Promise<void>) => {
    setBusy(true);
    try { await f(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-primary/15"><KeyRound className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="font-medium">{k.label}</p>
          <p className="text-xs text-muted-foreground">{k.usage} · <span className="font-mono">{k.name}</span></p>
        </div>
        <Badge variant={k.source === "missing" ? "destructive" : k.source === "custom" ? "default" : "outline"}>{SOURCE[k.source]}</Badge>
      </div>
      <p className="mt-3 font-mono text-sm">{k.masked ?? "—"}</p>
      {k.updated_at && <p className="text-xs text-muted-foreground">Modifiée le {new Date(k.updated_at).toLocaleString("fr-FR")}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input type="password" autoComplete="off" placeholder="Nouvelle clé…" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button disabled={busy} variant="outline" onClick={() => wrap(async () => {
          const r = await test({ data: { name: k.name, value: value || undefined } });
          if (r.ok) toast.success("Clé valide");
          else toast.error(`Clé refusée (code ${r.status})`);
        })}>Tester</Button>
        <Button disabled={busy || !value} onClick={() => wrap(async () => {
          await save({ data: { name: k.name, value } });
          setValue(""); toast.success("Clé enregistrée"); qc.invalidateQueries({ queryKey: ["admin", "keys"] });
        })}>Enregistrer</Button>
      </div>
      {k.source === "custom" && (
        <Button variant="link" className="mt-2 h-auto p-0 text-xs" disabled={busy} onClick={() => wrap(async () => {
          await save({ data: { name: k.name, value: null } });
          toast.success("Retour à la clé par défaut"); qc.invalidateQueries({ queryKey: ["admin", "keys"] });
        })}>Revenir à la clé par défaut</Button>
      )}
    </div>
  );
}

function OpenRouterPool() {
  const get = useServerFn(adminGetOpenRouterPool);
  const save = useServerFn(adminSaveOpenRouterPool);
  const test = useServerFn(adminTestOpenRouterPool);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "or-pool"], queryFn: () => get() });
  const [add, setAdd] = useState("");
  const [remove, setRemove] = useState<number[]>([]);
  const [fb, setFb] = useState<string | null>(null);
  const [vfb, setVfb] = useState<string | null>(null);
  const [results, setResults] = useState<{ masked: string; ok: boolean; status: number; remaining: number | null }[] | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const newKeys = add.split(/\s+/).filter(Boolean);
  const total = data.keys.length - remove.length + newKeys.length;
  const run = async (f: () => Promise<void>) => { setBusy(true); try { await f(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } };
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-md bg-primary/15"><KeyRound className="size-4" /></span>
        <div className="flex-1">
          <p className="font-medium">Clés OpenRouter de relais</p>
          <p className="text-xs text-muted-foreground">Jusqu'à 100 clés. Quand une clé n'a plus de crédits, la suivante prend le relais automatiquement.</p>
        </div>
        <Badge variant="outline">{data.keys.length}/100</Badge>
      </div>
      {data.keys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.keys.map((k) => (
            <button key={k.index} type="button" onClick={() => setRemove((r) => r.includes(k.index) ? r.filter((x) => x !== k.index) : [...r, k.index])}
              className={`rounded-md border border-border px-2 py-1 font-mono text-xs ${remove.includes(k.index) ? "line-through opacity-50" : ""}`}
              title="Cliquer pour retirer">#{k.index + 1} {k.masked}</button>
          ))}
        </div>
      )}
      <Textarea rows={3} placeholder="Ajouter des clés (une par ligne)…" value={add} onChange={(e) => setAdd(e.target.value)} className="font-mono text-xs" />
      <div className="space-y-1">
        <p className="text-sm font-medium">Modèles texte de secours</p>
        <p className="text-xs text-muted-foreground">Si toutes les clés sont à court de crédits pour le modèle principal, ces modèles sont essayés dans l'ordre (séparés par des virgules).</p>
        <Input value={fb ?? data.fallbackModels} onChange={(e) => setFb(e.target.value)} placeholder="openai/gpt-5-nano, google/gemini-2.5-flash-lite" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Modèles vidéo de secours</p>
        <Input value={vfb ?? data.videoFallbacks} onChange={(e) => setVfb(e.target.value)} placeholder="bytedance/seedance-2.0-fast, alibaba/wan-2.6" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || total > 100} onClick={() => run(async () => {
          const r = await save({ data: { add: newKeys, remove, fallbackModels: fb ?? data.fallbackModels, videoFallbacks: vfb ?? data.videoFallbacks } });
          setAdd(""); setRemove([]); setFb(null); setVfb(null); setResults(null);
          toast.success(`${r.count} clé(s) de relais enregistrée(s)`);
          qc.invalidateQueries({ queryKey: ["admin", "or-pool"] });
        })}>Enregistrer{total > 100 ? " (max 100)" : ""}</Button>
        <Button variant="outline" disabled={busy} onClick={() => run(async () => setResults(await test()))}>Tester toutes les clés</Button>
      </div>
      {results && (
        <ul className="space-y-1 text-xs">
          {results.map((r, i) => (
            <li key={i} className="flex justify-between font-mono">
              <span>{r.masked}</span>
              <span className={r.ok ? "" : "text-destructive"}>{r.ok ? (r.remaining == null ? "valide · sans limite" : `valide · reste ${r.remaining}`) : `refusée (${r.status})`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
