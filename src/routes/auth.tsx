import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AppHeader } from "@/components/AppHeader";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `Connexion — ${BRAND}` },
      { name: "description", content: `Connectez-vous à ${BRAND} pour conserver vos vidéos et storyboards.` },
      { property: "og:title", content: `Connexion — ${BRAND}` },
      { property: "og:description", content: "Votre bibliothèque personnelle de vidéos IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset" | "newpass">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const recovering = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && !recovering.current) navigate({ to: "/bibliotheque" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "PASSWORD_RECOVERY") {
        recovering.current = true;
        setMode("newpass");
        setPassword("");
        setErr(null);
        setMsg("Choisissez un nouveau mot de passe pour sécuriser votre compte.");
        return;
      }
      if (e === "SIGNED_IN" && s && !recovering.current) navigate({ to: "/bibliotheque" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) setErr(error.message);
      else setMsg("Si un compte existe pour cet e-mail, un lien de réinitialisation vient d’être envoyé.");
      setBusy(false);
      return;
    }
    if (mode === "newpass") {
      if (password.length < 6) {
        setErr("Le mot de passe doit contenir au moins 6 caractères.");
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setErr(error.message);
      else {
        recovering.current = false;
        setMsg("Mot de passe mis à jour.");
        navigate({ to: "/bibliotheque" });
      }
      setBusy(false);
      return;
    }
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setErr("Identifiants incorrects ou e-mail non confirmé.");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/auth" },
      });
      if (error) setErr(error.message);
      else if (!data.session) setMsg("Vérifiez votre boîte mail pour confirmer votre compte.");
    }
    setBusy(false);
  }

  async function google() {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) setErr("Connexion Google impossible.");
  }

  const title =
    mode === "reset"
      ? "Réinitialiser le mot de passe"
      : mode === "newpass"
        ? "Nouveau mot de passe"
        : mode === "in"
          ? "Bon retour sur le plateau"
          : "Créer votre compte";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto grid max-w-md px-5 py-14">
        <div className="rise rounded-[14px] bg-paper p-7 ring-1 ring-white/5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            Accès studio
          </p>
          <h1 className="mt-2 font-display text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "reset"
              ? "Nous vous enverrons un lien pour choisir un nouveau mot de passe."
              : mode === "newpass"
                ? "Saisissez votre nouveau mot de passe (6 caractères minimum)."
                : "Vos clips et storyboards sont conservés durablement dans votre bibliothèque."}
          </p>

          {mode !== "reset" && mode !== "newpass" ? (
            <>
              <button
                onClick={google}
                className="mt-6 w-full rounded-full bg-background py-2.5 text-sm font-medium ring-1 ring-white/10 hover:bg-white/5"
              >
                Continuer avec Google
              </button>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono text-[10px] uppercase text-muted-foreground/60">ou</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : (
            <div className="mt-6" />
          )}

          <form onSubmit={submit} className="space-y-3">
            {mode !== "newpass" ? (
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                className="w-full rounded-[10px] bg-background px-4 py-2.5 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
              />
            ) : null}
            {mode !== "reset" ? (
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "newpass" ? "Nouveau mot de passe" : "Mot de passe"}
                className="w-full rounded-[10px] bg-background px-4 py-2.5 text-sm outline-none ring-1 ring-white/10 focus:ring-primary"
              />
            ) : null}
            <button
              disabled={busy}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary-deep disabled:opacity-50"
            >
              {busy
                ? "…"
                : mode === "reset"
                  ? "Envoyer le lien"
                  : mode === "newpass"
                    ? "Enregistrer le mot de passe"
                    : mode === "in"
                      ? "Se connecter"
                      : "Créer le compte"}
            </button>
          </form>
          {err ? <p className="mt-3 text-sm text-destructive">{err}</p> : null}
          {msg ? <p className="mt-3 text-sm text-primary-deep">{msg}</p> : null}

          <div className="mt-5 flex flex-col gap-2 text-xs text-muted-foreground">
            {mode === "in" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("reset");
                  setErr(null);
                  setMsg(null);
                }}
                className="underline-offset-4 hover:underline"
              >
                Mot de passe oublié ?
              </button>
            ) : null}
            {mode !== "newpass" ? (
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "up" ? "in" : mode === "reset" ? "in" : "up");
                  setErr(null);
                  setMsg(null);
                }}
                className="underline-offset-4 hover:underline"
              >
                {mode === "in"
                  ? "Pas encore de compte ? Inscrivez-vous"
                  : mode === "up"
                    ? "Déjà inscrit ? Connectez-vous"
                    : "Retour à la connexion"}
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
