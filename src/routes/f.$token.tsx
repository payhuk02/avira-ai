import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Film } from "lucide-react";
import { getSharedClip } from "@/lib/projects.functions";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/f/$token")({
  loader: async ({ params }) => {
    const result = await getSharedClip({ data: { token: params.token } }).catch(() => null);
    if (!result || !result.ok) {
      if (result?.reason === "rate_limit") {
        throw new Error("RATE_LIMIT");
      }
      throw notFound();
    }
    return result;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.scene.slice(0, 60)} — Film ${BRAND}` : `Film partagé — ${BRAND}`;
    const description = `Un film généré par IA avec ${BRAND}, l'atelier vidéo des créateurs.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "video.other" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  component: SharedFilm,
  notFoundComponent: () => (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div>
        <p className="font-mono text-[10px] uppercase text-muted-foreground">Lien indisponible</p>
        <h1 className="mt-2 font-display text-3xl">Ce film n'est plus partagé</h1>
        <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          Découvrir {BRAND}
        </Link>
      </div>
    </main>
  ),
  errorComponent: ({ error }) => {
    const rateLimited = error instanceof Error && error.message === "RATE_LIMIT";
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            {rateLimited ? "Trop de requêtes" : "Erreur"}
          </p>
          <h1 className="mt-2 font-display text-3xl">
            {rateLimited ? "Réessayez dans une minute" : "Impossible de charger ce film"}
          </h1>
          <Link to="/" className="mt-6 inline-flex rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
            Découvrir {BRAND}
          </Link>
        </div>
      </main>
    );
  },
});

function SharedFilm() {
  const clip = Route.useLoaderData();
  const vertical = clip.format === "9:16" || clip.format === "4:5";
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2 font-display text-xl">
          <Film className="size-5 text-primary" /> {BRAND}
        </Link>
        <Link to="/auth" className="rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
          Créer mon film
        </Link>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div
          className={`mx-auto overflow-hidden rounded-[18px] bg-card shadow-2xl ring-1 ring-white/10 ${
            vertical ? "max-w-sm" : "max-w-5xl"
          }`}
        >
          <video src={clip.url} controls autoPlay playsInline className="w-full" />
        </div>
        <div className="mx-auto mt-6 max-w-3xl text-center">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            {clip.format} · {clip.resolution} · {clip.duration} s ·{" "}
            {new Date(clip.created_at).toLocaleDateString("fr-FR")}
          </p>
          <h1 className="mt-3 font-display text-2xl sm:text-3xl">{clip.scene}</h1>
          <p className="mt-3 text-sm text-muted-foreground">Réalisé avec {BRAND}, l'atelier vidéo IA.</p>
        </div>
      </section>
    </main>
  );
}
