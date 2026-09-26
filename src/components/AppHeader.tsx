import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

const NAV = [
  { to: "/", label: "Accueil" },
  { to: "/studio", label: "Studio" },
  { to: "/storyboard", label: "Storyboard" },
  { to: "/bibliotheque", label: "Bibliothèque" },
] as const;

export function AppHeader({ children }: { children?: ReactNode }) {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="border-b border-border/70 bg-paper/80">
      <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-2 sm:px-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-[10px] bg-white">
            <span className="font-display text-lg leading-none text-black">A</span>
          </div>
          <div className="leading-none">
            <p className="font-display text-lg">Avira ai</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
              Studio de projection
            </p>
          </div>
        </Link>

        <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/5"
              activeProps={{ className: "bg-white text-black hover:bg-white" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {children}
          {ready && user ? (
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/" });
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground ring-1 ring-white/10 hover:bg-white/5"
              title={user.email ?? undefined}
            >
              Déconnexion
            </button>
          ) : ready ? (
            <Link
              to="/auth"
              className="rounded-full bg-white px-4 py-1.5 text-xs font-medium text-black"
            >
              Se connecter
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
