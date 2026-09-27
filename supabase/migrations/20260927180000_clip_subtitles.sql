-- Sous-titres IA persistés sur le clip (JSON array de { start, end, text }).
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS subtitles jsonb;
