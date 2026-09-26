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

## Avira ai — architecture

- Product brand: **Avira ai** (studio vidéo IA).
- Clips and storyboards live in Supabase (tables clips/storyboards/projects, private bucket `videos`); MP4s are copied from the AI provider to storage on completion.
- AI calls go through authenticated server functions in `src/lib/*.functions.ts`; no public video API routes, so only signed-in users spend credits.
- All authenticated creator pages render inside `WorkspaceShell`.
- Admin console lives under `/_authenticated/admin` with `AdminShell`; API key/model overrides are stored in `app_config` (service-role only) and read by `gateway.server` before env fallback.
- Public share pages (`/f/$token`) resolve clips via `share_token` with the admin client inside `getSharedClip` only; rate-limited (in-memory + `usage_counters`).
- Quotas / budget: `src/lib/limits.server.ts` (daily per-user + monthly platform budget).
- SQL source of truth: `supabase/migrations/` (keep in sync with the live Supabase project).
- Supabase project id is configured in `.env` and `supabase/config.toml` (keep them in sync).
- Promo admin: insert into `user_roles` after signup (no hardcoded bootstrap email).
