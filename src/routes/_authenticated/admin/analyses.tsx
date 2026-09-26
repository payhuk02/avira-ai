import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { adminAskInsights } from "@/lib/admin.functions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/analyses")({ component: InsightsPage });

const SUGGESTIONS = [
  "Pourquoi des générations échouent-elles et comment réduire ce taux ?",
  "Où partent nos coûts et comment rester dans le budget ce mois-ci ?",
  "Quelles tendances d'activité voyez-vous sur les 30 derniers jours ?",
  "Quelles résolutions devrions-nous autoriser ou limiter ?",
];

function InsightsPage() {
  const ask = useServerFn(adminAskInsights);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (q = question) => {
    if (q.trim().length < 3 || busy) return;
    setQuestion(q); setBusy(true); setError(null); setAnswer(null);
    try {
      const r = await ask({ data: { question: q } });
      if (r.error) setError(r.error); else setAnswer(r.answer);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-muted-foreground">
        Posez une question sur l'activité de la plateforme. L'IA analyse les 30 derniers jours (générations, échecs, coûts estimés, paramètres) et propose des actions.
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <Button key={s} size="sm" variant="outline" className="h-auto whitespace-normal text-left" disabled={busy} onClick={() => submit(s)}>{s}</Button>
        ))}
      </div>
      <div className="space-y-2">
        <Textarea rows={3} maxLength={1000} placeholder="Votre question…" value={question} onChange={(e) => setQuestion(e.target.value)} />
        <Button onClick={() => submit()} disabled={busy || question.trim().length < 3}>
          <Sparkles /> {busy ? "Analyse en cours…" : "Analyser"}
        </Button>
      </div>
      {error && <p className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {answer && (
        <div className="whitespace-pre-wrap rounded-lg border border-border bg-card p-5 text-sm leading-relaxed">{answer}</div>
      )}
    </div>
  );
}
