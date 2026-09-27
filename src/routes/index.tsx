import { createFileRoute, Link } from "@tanstack/react-router";
import { FORMATS, SKIN_TONES } from "@/lib/studio";
import heroVideo from "@/assets/hero-real-action.mp4.asset.json";
import format169 from "@/assets/format-169.jpg";
import format916 from "@/assets/format-916.jpg";
import format11 from "@/assets/format-11.jpg";
import format219 from "@/assets/format-219.jpg";
import format45 from "@/assets/format-45.jpg";
import { ArrowUp, Instagram, Linkedin, Mail, Youtube } from "lucide-react";
import { BRAND, BRAND_CONTACT } from "@/lib/brand";

/** Adresse de contact affichée en pied de page — remplacez-la par la vôtre. */
const CONTACT_EMAIL = BRAND_CONTACT;

/** Réseaux sociaux — remplacez "#" par l'URL de vos vrais profils. */
const SOCIALS = [
  { label: "Instagram", href: "#", icon: Instagram },
  { label: "YouTube", href: "#", icon: Youtube },
  { label: "LinkedIn", href: "#", icon: Linkedin },
] as const;

type FooterLink = {
  label: string;
  to?: "/" | "/studio" | "/storyboard" | "/bibliotheque" | "/auth";
  hash?: string;
};

const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Plateforme",
    links: [
      { label: "Accueil", to: "/" },
      { label: "Studio", to: "/studio" },
      { label: "Storyboard IA", to: "/storyboard" },
      { label: "Bibliothèque", to: "/bibliotheque" },
      { label: "Se connecter", to: "/auth" },
    ],
  },
  {
    title: "Découvrir",
    links: [
      { label: "Tous les formats", hash: "formats" },
      { label: "Fonctionnalités", hash: "fonctionnalites" },
      { label: "Comment ça marche", hash: "etapes" },
      { label: "Exemples de scènes", hash: "exemples" },
    ],
  },
  {
    title: "Formats",
    links: [
      { label: "16:9 — Cinéma", hash: "formats" },
      { label: "9:16 — Vertical", hash: "formats" },
      { label: "1:1 — Carré", hash: "formats" },
      { label: "21:9 — Scope", hash: "formats" },
      { label: "4:5 — Social", hash: "formats" },
    ],
  },
];

const FOOTER_LINK_CLASS =
  "w-fit rounded-full px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-white/5 hover:text-white";

const FORMAT_IMAGES: Record<string, { src: string; w: number; h: number; alt: string }> = {
  "16:9": { src: format169, w: 1280, h: 720, alt: "Rue néon sous la pluie, format cinéma 16:9" },
  "9:16": { src: format916, w: 720, h: 1280, alt: "Robe fluide devant une tour, format vertical 9:16" },
  "1:1": { src: format11, w: 1024, h: 1024, alt: "Portrait néon violet, format carré 1:1" },
  "21:9": { src: format219, w: 1920, h: 832, alt: "Désert au crépuscule, format scope 21:9" },
  "4:5": { src: format45, w: 1024, h: 1280, alt: "Galerie de musée violette, format social 4:5" },
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${BRAND} — Studio vidéo IA : décrivez, cadrez, générez` },
      {
        name: "description",
        content:
          `${BRAND} transforme vos idées en clips vidéo IA photoréalistes : casting réel au choix, cinq formats, storyboard et bibliothèque personnelle.`,
      },
      { property: "og:title", content: `${BRAND} — Studio vidéo IA : décrivez, cadrez, générez` },
      {
        property: "og:description",
        content:
          "Décrivez une scène, composez le casting (teint de peau, genre, âge) et générez des clips photoréalistes en 16:9, 9:16, 1:1, 21:9 ou 4:5.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const EXAMPLES = [
  {
    scene:
      "Une femme de 35 ans marche dans une rue de Lyon au crépuscule, plan moyen qui glisse latéralement, ambiance contemplative.",
    format: "16:9",
    duration: "6 s",
  },
  {
    scene:
      "Un homme de 45 ans prépare un café dans une cuisine baignée de lumière du matin, plan serré sur les mains, bruit du café.",
    format: "1:1",
    duration: "8 s",
  },
  {
    scene:
      "Deux amis rient sur un toit-terrasse à Abidjan, contre-plongée lente, soleil couchant derrière la skyline.",
    format: "21:9",
    duration: "5 s",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Décrivez",
    text: "Une phrase suffit : le lieu, l'ambiance, le mouvement de caméra. En français, comme vous la raconteriez.",
  },
  {
    n: "02",
    title: "Composez",
    text: "Casting, format, durée, lumière et grain se règlent d'un geste, pendant que l'aperçu se recadre en direct.",
  },
  {
    n: "03",
    title: "Générez",
    text: "Le rendu photoréaliste arrive en une à trois minutes, puis il vit pour de bon dans votre bibliothèque.",
  },
];

function Landing() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Ambient violet glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-[10px] bg-white">
              <span className="font-display text-lg italic leading-none text-black">A</span>
            </div>
            <div className="leading-none">
              <p className="font-display text-lg italic">{BRAND}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                Studio vidéo IA
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/auth"
              className="rounded-full px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              Se connecter
            </Link>
            <Link
              to="/studio"
              className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-white/90"
            >
              Entrer dans le studio
            </Link>
          </div>
        </div>
      </header>

      <main className="relative">
        {/* Hero */}
        <section className="mx-auto max-w-[1200px] px-5 pb-14 pt-14 sm:px-8 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
            <div className="rise">
              <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
                Studio vidéo IA — tous formats
              </p>
              <h1 className="mt-4 font-display text-5xl italic leading-[1.05] tracking-tight text-white sm:text-6xl">
                Décrivez la scène.
                <br />
                <span className="text-primary">{BRAND} la tourne.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Vos idées deviennent des clips vidéo photoréalistes : casting réel au choix — teint
                de peau, genre, âge — cinq formats d'image, lumière et grain réglables, storyboard
                IA et bibliothèque personnelle.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-sm font-medium text-black shadow-[0_0_25px_rgba(139,92,246,0.3)] transition-all hover:bg-primary hover:text-white"
                >
                  <span className="grid size-4 place-items-center">
                    <span className="size-2.5 rounded-full bg-current" />
                  </span>
                  Créer mon compte
                </Link>
                <Link
                  to="/studio"
                  className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium text-foreground ring-1 ring-white/15 transition-colors hover:bg-white/5"
                >
                  Ouvrir le studio →
                </Link>
              </div>
              <p className="mt-6 font-mono text-[11px] tracking-wide text-muted-foreground/70">
                RENDU 720P · 24 IPS · 3 À 10 SECONDES · 5 FORMATS
              </p>
            </div>

            <div className="rise2">
              <div className="rounded-[16px] border border-white/10 bg-card p-4 shadow-2xl shadow-primary/20 sm:p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-2 animate-pulse rounded-full bg-primary" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Projection — 16:9
                    </span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
                    Dusk · Golden
                  </span>
                </div>
                <div className="relative overflow-hidden rounded-[10px]">
                  <video
                    src={heroVideo.url}
                    aria-label={`Rendu ${BRAND} : équipe de tournage et acteurs réels en action`}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    disablePictureInPicture
                    className="block aspect-[16/9] w-full object-cover"
                  />
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-white backdrop-blur-sm">
                    16:9 · Cinéma
                  </span>
                  <div className="filmtrack pointer-events-none absolute inset-y-0 left-0 w-3 bg-white/40" />
                  <div className="filmtrack pointer-events-none absolute inset-y-0 right-0 w-3 bg-white/40" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Formats */}
        <section id="formats" className="scroll-mt-24 border-y border-white/5 bg-card/50">
          <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-display text-2xl italic leading-tight text-white sm:text-3xl">
                Tous les formats du cinéma au vertical
              </h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Du scope 21:9 au format social 4:5 — l'aperçu se recadre en direct pendant que vous
                composez.
              </p>
            </div>
            <div className="mt-7 grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {FORMATS.map((f, i) => (
                <div
                  key={f.id}
                  className="rise rounded-[12px] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <div
                    className="mb-3 overflow-hidden rounded-[6px] ring-1 ring-primary/20"
                    style={{ aspectRatio: f.ratio }}
                  >
                    <img
                      src={FORMAT_IMAGES[f.id]?.src}
                      alt={FORMAT_IMAGES[f.id]?.alt ?? `Format ${f.id}`}
                      width={FORMAT_IMAGES[f.id]?.w}
                      height={FORMAT_IMAGES[f.id]?.h}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                    />
                  </div>
                  <p className="text-sm font-medium text-white">{f.id}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {f.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="fonctionnalites" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 py-16 sm:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
            Ce que {BRAND} sait faire
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl italic leading-tight text-white sm:text-4xl">
            Un vrai plateau de tournage, tenu en trois panneaux.
          </h2>
          <div className="mt-9 grid gap-5 md:grid-cols-3">
            <div className="rise rounded-[14px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Casting
              </span>
              <h3 className="mt-3 font-display text-xl italic text-white">Des visages réels, à votre image</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Choisissez le teint de peau, le genre et la tranche d'âge de chaque rôle — du
                protagoniste au second plan. Peaux claires à très foncées, toujours photoréalistes.
              </p>
              <div className="mt-5 flex gap-1.5">
                {SKIN_TONES.map((t) => (
                  <span
                    key={t.id}
                    title={t.label}
                    style={{ backgroundColor: t.hex }}
                    className="size-6 rounded-full ring-1 ring-white/10"
                  />
                ))}
              </div>
            </div>
            <div className="rise2 rounded-[14px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Storyboard
              </span>
              <h3 className="mt-3 font-display text-xl italic text-white">Votre idée, scène par scène</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Décrivez votre projet : le modèle le découpe en 4 à 8 scènes prêtes à tourner, avec
                plan, action, caméra, lumière et son. Un clic ouvre la scène dans le studio.
              </p>
              <div className="mt-5 space-y-2">
                {["Plan large — établissement", "Plan moyen — action", "Gros plan — détail"].map(
                  (s) => (
                    <div
                      key={s}
                      className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 ring-1 ring-white/5"
                    >
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        {s}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="rise3 rounded-[14px] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                Bibliothèque
              </span>
              <h3 className="mt-3 font-display text-xl italic text-white">Vos clips, gardés pour de bon</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Chaque rendu est conservé dans votre bibliothèque personnelle avec son format, sa
                durée et sa scène. Relisez-les, téléchargez-les ou replacez-les en un clic.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="aspect-[16/10] rounded-[8px] bg-gradient-to-br from-primary/30 to-primary/10 ring-1 ring-white/5"
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section id="etapes" className="scroll-mt-24 border-y border-white/5 bg-card/50">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-primary">
              Comment ça marche
            </p>
            <div className="mt-8 grid gap-8 md:grid-cols-3">
              {STEPS.map((s) => (
                <div key={s.n}>
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-sm text-primary">{s.n}</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  <h3 className="mt-4 font-display text-2xl italic text-white">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Example scenes */}
        <section id="exemples" className="mx-auto max-w-[1200px] scroll-mt-24 px-5 py-16 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-3xl italic leading-tight text-white sm:text-4xl">
              Trois scènes, prêtes à tourner
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Voilà à quoi ressemble un prompt {BRAND}. Copiez-en un, ou écrivez le vôtre.
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {EXAMPLES.map((e, i) => (
              <article
                key={e.format + i}
                className="rise flex flex-col rounded-[14px] border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">
                    {e.format}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {e.duration}
                  </span>
                </div>
                <p className="mt-4 flex-1 font-mono text-[11.5px] leading-relaxed text-muted-foreground">
                  « {e.scene} »
                </p>
                <Link
                  to="/studio"
                  className="mt-5 inline-flex w-fit rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-primary hover:text-white"
                >
                  Tourner cette scène →
                </Link>
              </article>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-5 pb-16 sm:px-8">
          <div className="relative mx-auto max-w-[1200px] overflow-hidden rounded-[18px] border border-white/10 bg-card px-8 py-14 text-center sm:py-20">
            <div className="pointer-events-none absolute -top-20 left-1/2 h-[200px] w-[400px] -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
            <p className="relative font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Le projecteur est branché
            </p>
            <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-4xl italic leading-tight text-white sm:text-5xl">
              Prêt à passer derrière la caméra ?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Créez votre compte, décrivez votre première scène et regardez {BRAND} la tourner —
              puis gardez chaque clip dans votre bibliothèque.
            </p>
            <Link
              to="/auth"
              className="relative mt-8 inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-black shadow-[0_0_25px_rgba(139,92,246,0.3)] transition-all hover:bg-primary hover:text-white"
            >
              <span className="grid size-4 place-items-center">
                <span className="size-2.5 rounded-full bg-current" />
              </span>
              Créer mon compte gratuitement
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        aria-label="Pied de page"
        className="relative overflow-hidden border-t border-white/5 bg-background"
      >
        <div className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="pointer-events-none absolute -top-32 left-1/2 h-[240px] w-[640px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />

        <div className="relative mx-auto max-w-[1200px] px-5 pb-8 pt-14 sm:px-8 sm:pt-16">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_1.95fr]">
            {/* Marque */}
            <div>
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-[11px] bg-white">
                  <span className="font-display text-xl italic leading-none text-black">A</span>
                </div>
                <div className="leading-none">
                  <p className="font-display text-xl italic text-white">{BRAND}</p>
                  <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/70">
                    Studio vidéo IA
                  </p>
                </div>
              </div>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Décrivez une scène, choisissez vos acteurs, votre lumière et votre format : {BRAND}
                tourne le clip, le décline en storyboard et le garde dans votre bibliothèque.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-2">
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-medium text-black transition-colors hover:bg-primary hover:text-white"
                >
                  <Mail className="size-3.5" />
                  Nous écrire
                </a>
                <Link
                  to="/auth"
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-medium text-foreground ring-1 ring-white/15 transition-colors hover:bg-white/5"
                >
                  Créer un compte
                </Link>
              </div>
              <div className="mt-7 flex items-center gap-2">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    title={s.label}
                    className="grid size-9 place-items-center rounded-full text-muted-foreground ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <s.icon className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Colonnes de liens */}
            <nav className="grid gap-10 sm:grid-cols-3" aria-label="Liens du pied de page">
              {FOOTER_COLUMNS.map((col) => (
                <div key={col.title}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
                    {col.title}
                  </p>
                  <ul className="mt-4 space-y-1">
                    {col.links.map((l) => (
                      <li key={l.label}>
                        {l.to ? (
                          <Link to={l.to} className={FOOTER_LINK_CLASS}>
                            {l.label}
                          </Link>
                        ) : (
                          <a href={`#${l.hash}`} className={FOOTER_LINK_CLASS}>
                            {l.label}
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          {/* Barre basse */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              © {new Date().getFullYear()} {BRAND} · Tous droits réservés
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
              Tous formats · Casting réel · Bibliothèque privée
            </p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground ring-1 ring-white/10 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ArrowUp className="size-3" />
              Haut de page
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
