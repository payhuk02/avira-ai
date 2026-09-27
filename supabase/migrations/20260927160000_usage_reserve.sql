-- Quotas atomiques : réserve / libère un slot journalier sous plafond.
-- kinds étendus : clip, storyboard, assist, voiceover, share

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

  RETURN _next; -- NULL si plafond atteint (WHERE du DO UPDATE non satisfait)
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
