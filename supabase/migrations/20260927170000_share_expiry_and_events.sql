-- Share expiry + generation_events (observabilité cascade vidéo)
-- Rate-limit share courte fenêtre : usage_counters (subject share_m:…) — déjà supporté par reserve_usage.

ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS share_expires_at timestamptz;
CREATE INDEX IF NOT EXISTS clips_share_token_idx ON public.clips (share_token) WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  clip_id uuid,
  provider text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  outcome text NOT NULL CHECK (outcome IN ('ok', 'error', 'skip')),
  http_status int,
  latency_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS generation_events_created_idx ON public.generation_events (created_at DESC);
CREATE INDEX IF NOT EXISTS generation_events_clip_idx ON public.generation_events (clip_id) WHERE clip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS generation_events_user_idx ON public.generation_events (user_id, created_at DESC);

GRANT ALL ON public.generation_events TO service_role;
ALTER TABLE public.generation_events ENABLE ROW LEVEL SECURITY;
-- Pas de policy authenticated : lecture via admin (service_role) uniquement.

COMMENT ON TABLE public.generation_events IS 'Journal des tentatives provider vidéo (cascade). service_role only.';

-- Aligne les compteurs clip/storyboard du jour avec les lignes déjà créées (évite double quota post-migration).
INSERT INTO public.usage_counters (subject_id, day, kind, count, updated_at)
SELECT c.user_id::text, (timezone('utc', now()))::date, 'clip', count(*)::int, now()
FROM public.clips c
WHERE c.created_at >= ((timezone('utc', now()))::date)::timestamptz
  AND c.status IN ('pending', 'done')
GROUP BY c.user_id
ON CONFLICT (subject_id, day, kind) DO UPDATE
SET count = GREATEST(public.usage_counters.count, EXCLUDED.count), updated_at = now();

INSERT INTO public.usage_counters (subject_id, day, kind, count, updated_at)
SELECT s.user_id::text, (timezone('utc', now()))::date, 'storyboard', count(*)::int, now()
FROM public.storyboards s
WHERE s.created_at >= ((timezone('utc', now()))::date)::timestamptz
GROUP BY s.user_id
ON CONFLICT (subject_id, day, kind) DO UPDATE
SET count = GREATEST(public.usage_counters.count, EXCLUDED.count), updated_at = now();
