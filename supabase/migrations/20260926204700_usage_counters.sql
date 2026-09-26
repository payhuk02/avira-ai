-- Compteurs d'usage journaliers — service_role only.
-- subject_id = auth user uuid, ou "share:<fingerprint>" pour les liens publics.
CREATE TABLE IF NOT EXISTS public.usage_counters (
  subject_id text NOT NULL,
  day date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('assist', 'voiceover', 'share')),
  count int NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subject_id, day, kind)
);
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS usage_counters_day_idx ON public.usage_counters (day DESC);
