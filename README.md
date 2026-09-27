# Avira ai

Plateforme premium et responsive de création de vidéos avec IA, tous formats. Les vidéos générées sont photoréalistes avec un casting configurable (teint de peau, genre, âge).

Stack : TanStack Start · React 19 · Supabase · Bun.

Repo : https://github.com/payhuk02/avira-ai

## Développement local

```sh
bun install
bun run dev
```

Copiez `.env.example` vers `.env` et renseignez votre projet Supabase (`SUPABASE_*` + `SUPABASE_SERVICE_ROLE_KEY` pour admin / partage).

Scripts : `bun run build`, `bun run lint`, `bun run typecheck`, `bun run preview`.

## Déploiement Vercel

Dans **Project → Settings → Environment Variables**, ajoutez (Production + Preview) :

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | `https://…supabase.co` (embeddée au build client) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | clé `sb_publishable_…` |
| `VITE_SUPABASE_PROJECT_ID` | id projet |
| `SUPABASE_URL` | même URL (recommandé pour le serveur) |
| `SUPABASE_PUBLISHABLE_KEY` | même clé publishable (recommandé) |
| `SUPABASE_PROJECT_ID` | même id |
| `SUPABASE_SERVICE_ROLE_KEY` | clé `sb_secret_…` (**obligatoire** pour quotas, partage, admin) |

Le serveur accepte aussi les `VITE_*` en fallback si les `SUPABASE_*` manquent.  
Puis **Redeploy** (les `VITE_*` ne sont prises en compte qu’au build).

Dans Supabase → Authentication → URL Configuration, ajoutez :
- Site URL : `https://avira-ai-seven.vercel.app`
- Redirect URLs : `https://avira-ai-seven.vercel.app/**` et `http://localhost:5173/**`

## Admin

Après la première inscription :

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'votre@email.com'
ON CONFLICT DO NOTHING;
```

Migrations SQL : `supabase/migrations/` (exécuter dans le SQL Editor Supabase).
