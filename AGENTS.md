<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Acostudio ai — architecture

- Product brand: **Acostudio ai** — constants in `src/lib/brand.ts`.
- Clips and storyboards live in Supabase (tables clips/storyboards/projects, private bucket `videos`); MP4s are copied from the AI provider to storage on completion.
- AI calls go through authenticated server functions in `src/lib/*.functions.ts`; no public video API routes, so only signed-in users spend credits.
- All authenticated creator pages render inside `WorkspaceShell`.
- Admin console lives under `/_authenticated/admin` with `AdminShell`; API key/model overrides are stored in `app_config` (service-role only) and read by `gateway.server` before env fallback.
- Public share pages (`/f/$token`) resolve clips via `share_token` with the admin client inside `getSharedClip` only; rate-limited via `usage_counters` (30/min + 200/day per token); links expire after 7 days (`share_expires_at`).
- Quotas / budget: `src/lib/limits.server.ts` — atomic `reserve_usage` / `release_usage` RPCs (daily per-user + monthly platform budget on `done` clips only).
- Cascade attempts logged to `generation_events` (Admin → Journal → Cascade vidéo).
- SQL source of truth: `supabase/migrations/` (keep in sync with the live Supabase project).
- Supabase project id is configured in `.env` and `supabase/config.toml` (keep them in sync).

### Bootstrap admin (first deploy)

1. Sign up once in the app (Auth → email).
2. In Supabase SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = 'votre@email.com'
ON CONFLICT DO NOTHING;
```

3. Enable MFA for that Auth user (Dashboard → Authentication → Users) when available.
4. Rotate provider API keys after any suspected admin compromise; changes are audited in `admin_audit_log`.
5. Never hardcode a bootstrap email in the repo.