import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { adminGetSettings, adminSaveSettings, adminListOpenRouterModels, adminListOpenRouterVideoModels } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RUNWAY_MODELS } from "@/lib/runway-models";

export const Route = createFileRoute("/_authenticated/admin/parametres")({ component: SettingsPage });

const RES = ["360p", "720p", "1080p", "4k"] as const;
type Res = (typeof RES)[number];

function SettingsPage() {
  const get = useServerFn(adminGetSettings);
  const save = useServerFn(adminSaveSettings);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => get() });
  const [s, setS] = useState<null | {
    videoModel: string; textModel: string; openaiModel: string; googleVideoModel: string;
    runwayVideoModel: string; runwayConfigured: boolean; openrouterModel: string; openrouterConfigured: boolean;
    openrouterVideoModel: string; maxDuration: number; generationEnabled: boolean; allowedResolutions: Res[];
    monthlyBudget: number; alertThreshold: number; costPerVideoSecond: number; costPerStoryboard: number;
    dailyClipLimit: number; dailyStoryboardLimit: number; dailyAssistLimit: number; dailyVoiceoverLimit: number;
  }>(null);
  const [busy, setBusy] = useState(false);
  const listOr = useServerFn(adminListOpenRouterModels);
  const { data: orModels = [] } = useQuery({ queryKey: ["admin", "openrouter-models"], queryFn: () => listOr(), staleTime: 3600_000 });
  const listOrV = useServerFn(adminListOpenRouterVideoModels);
  const { data: orVideo = [] } = useQuery({ queryKey: ["admin", "openrouter-video"], queryFn: () => listOrV(), staleTime: 3600_000 });
  useEffect(() => { if (data) setS({ ...data, allowedResolutions: data.allowedResolutions as Res[] }); }, [data]);
  if (!s) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  const submit = async () => {
    setBusy(true);
    try {
      const { runwayConfigured: _rc, openrouterConfigured: _oc, ...payload } = s;
      await save({ data: payload });
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl space-y-6 rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label>Génération activée</Label>
          <p className="text-xs text-muted-foreground">Désactivez pour mettre les créations en maintenance.</p>
        </div>
        <Switch checked={s.generationEnabled} onCheckedChange={(v) => setS({ ...s, generationEnabled: v })} />
      </div>
      <div className="space-y-2">
        <Label>Modèle vidéo (passerelle Lovable)</Label>
        <Input value={s.videoModel} onChange={(e) => setS({ ...s, videoModel: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Modèle storyboard (passerelle Lovable)</Label>
        <Input value={s.textModel} onChange={(e) => setS({ ...s, textModel: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Modèle vidéo Runway {s.runwayConfigured ? "(actif par défaut)" : "(si clé Runway définie)"}</Label>
        <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={s.runwayVideoModel} onChange={(e) => setS({ ...s, runwayVideoModel: e.target.value })}>
          {RUNWAY_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}{m.t2v ? "" : " — image requise"} · {m.id}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label>Modèle OpenRouter {s.openrouterConfigured ? "(actif pour les textes)" : "(si clé OpenRouter définie)"} · {orModels.length} modèles</Label>
        <Input list="or-models" value={s.openrouterModel} onChange={(e) => setS({ ...s, openrouterModel: e.target.value })} placeholder="Rechercher un modèle…" />
        <datalist id="or-models">
          {orModels.map((m) => (
            <option key={m.id} value={m.id}>{m.name} · {Math.round(m.context / 1000)}k · {Number(m.prompt) === 0 ? "gratuit" : `$${(Number(m.prompt) * 1e6).toFixed(2)}/M`}</option>
          ))}
        </datalist>
      </div>
      <div className="space-y-2">
        <Label>Modèle vidéo OpenRouter · {orVideo.length} modèles</Label>
        <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={s.openrouterVideoModel} onChange={(e) => setS({ ...s, openrouterVideoModel: e.target.value })}>
          <option value="">Défaut Seedance mini (si clé OpenRouter)</option>
          {orVideo.map((m) => (
            <option key={m.id} value={m.id}>{m.id} · {Math.min(...m.durations)}–{Math.max(...m.durations)} s · {m.resolutions.join(", ")}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Si choisi et clé OpenRouter définie, prioritaire pour la génération vidéo.</p>
      </div>
      <div className="space-y-2">
        <Label>Modèle vidéo Google (Veo — si clé Google définie)</Label>
        <select
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={s.googleVideoModel}
          onChange={(e) => setS({ ...s, googleVideoModel: e.target.value })}
        >
          <option value="veo-3.1-lite-generate-preview">Veo 3.1 Lite · veo-3.1-lite-generate-preview</option>
          <option value="veo-3.1-fast-generate-preview">Veo 3.1 Fast · veo-3.1-fast-generate-preview</option>
          <option value="veo-3.1-generate-preview">Veo 3.1 · veo-3.1-generate-preview</option>
        </select>
        <p className="text-xs text-muted-foreground">
          En cas de quota épuisé, le serveur essaie automatiquement Lite → Fast → standard.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Modèle GPT OpenAI (si clé OpenAI définie)</Label>
        <Input value={s.openaiModel} onChange={(e) => setS({ ...s, openaiModel: e.target.value })} />
      </div>
      <div className="space-y-2">
        <Label>Durée maximale d'une vidéo (secondes, 5–10 appliqués au clip unitaire)</Label>
        <Input type="number" min={5} max={60} value={s.maxDuration}
          onChange={(e) => setS({ ...s, maxDuration: Math.min(60, Math.max(5, Number(e.target.value) || 5)) })} />
        <p className="text-xs text-muted-foreground">Les providers vidéo limitent souvent à 10 s par clip ; la valeur est plafonnée à 10 côté serveur.</p>
      </div>
      <div className="space-y-2">
        <Label>Résolutions autorisées</Label>
        <div className="flex flex-wrap gap-4">
          {RES.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <Checkbox checked={s.allowedResolutions.includes(r)} onCheckedChange={(v) =>
                setS({ ...s, allowedResolutions: v ? [...s.allowedResolutions, r] : s.allowedResolutions.filter((x) => x !== r) })} />
              {r}
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-4 border-t border-border pt-6">
        <div>
          <Label>Budget et estimation des coûts</Label>
          <p className="text-xs text-muted-foreground">
            En crédits. Si le budget mensuel est &gt; 0 et atteint, la génération est bloquée automatiquement.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Budget mensuel" value={s.monthlyBudget} onChange={(v) => setS({ ...s, monthlyBudget: v })} />
          <NumField label="Seuil d'alerte (%)" value={s.alertThreshold} onChange={(v) => setS({ ...s, alertThreshold: Math.min(100, Math.max(1, Math.round(v))) })} />
          <NumField label="Coût par seconde de vidéo" value={s.costPerVideoSecond} step={0.01} onChange={(v) => setS({ ...s, costPerVideoSecond: v })} />
          <NumField label="Coût par storyboard" value={s.costPerStoryboard} step={0.01} onChange={(v) => setS({ ...s, costPerStoryboard: v })} />
        </div>
      </div>
      <div className="space-y-4 border-t border-border pt-6">
        <div>
          <Label>Quotas journaliers par utilisateur</Label>
          <p className="text-xs text-muted-foreground">0 désactive la catégorie. Valeurs par défaut : 20 clips, 10 storyboards, 40 aides, 20 voix off.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumField label="Clips / jour" value={s.dailyClipLimit} onChange={(v) => setS({ ...s, dailyClipLimit: Math.round(v) })} />
          <NumField label="Storyboards / jour" value={s.dailyStoryboardLimit} onChange={(v) => setS({ ...s, dailyStoryboardLimit: Math.round(v) })} />
          <NumField label="Aides IA / jour" value={s.dailyAssistLimit} onChange={(v) => setS({ ...s, dailyAssistLimit: Math.round(v) })} />
          <NumField label="Voix off / jour" value={s.dailyVoiceoverLimit} onChange={(v) => setS({ ...s, dailyVoiceoverLimit: Math.round(v) })} />
        </div>
      </div>
      <Button onClick={submit} disabled={busy || !s.allowedResolutions.length}>Enregistrer</Button>
    </div>
  );
}

function NumField({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" min={0} step={step} value={value} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))} />
    </div>
  );
}
