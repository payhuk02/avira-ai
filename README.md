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

## Admin

Après la première inscription :

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = 'votre@email.com'
ON CONFLICT DO NOTHING;
```

Migrations SQL : `supabase/migrations/` (exécuter dans le SQL Editor Supabase).
