-- À coller dans Supabase Dashboard → SQL Editor → Run
-- Projet: hjjzwyxneekwhwhwqeih
      -- Couvre: usage_reserve + share_expiry/events + clip_subtitles

-- ===== usage reserve (idempotent) =====
ALTER TABLE public.usage_counters DROP CONSTRAINT IF EXISTS usage_counters_kind_check;
ALTER TABLE public.usage_counters
  ADD CONSTRAINT usage_counters_kind_check
  CHECK (kind IN ('assist', 'voiceover', 'share', 'clip', 'storyboard'));

CREATE OR REPLACE FUNCTION public.reserve_usage(_subject_id text, _kind text, _cap int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := (timezone('utc', now()))::date;
  _next int;
BEGIN
  IF _cap IS NULL OR _cap <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.usage_counters (subject_id, day, kind, count, updated_at)
  VALUES (_subject_id, _day, _kind, 1, now())
  ON CONFLICT (subject_id, day, kind)
  DO UPDATE SET
    count = usage_counters.count + 1,
    updated_at = now()
  WHERE usage_counters.count < _cap
  RETURNING usage_counters.count INTO _next;

  RETURN _next;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_usage(_subject_id text, _kind text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := (timezone('utc', now()))::date;
  _next int;
BEGIN
  UPDATE public.usage_counters
  SET count = GREATEST(0, count - 1), updated_at = now()
  WHERE subject_id = _subject_id AND day = _day AND kind = _kind
  RETURNING count INTO _next;
  RETURN COALESCE(_next, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_usage(text, text, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_usage(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_usage(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_usage(text, text) TO service_role;

-- ===== share expiry + generation_events =====
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

COMMENT ON TABLE public.generation_events IS 'Journal des tentatives provider vidéo (cascade). service_role only.';

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

-- Sous-titres IA persistés sur le clip (JSON array de { start, end, text }).
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS subtitles jsonb;
