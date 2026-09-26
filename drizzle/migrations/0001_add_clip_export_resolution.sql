ALTER TABLE public.clips
ADD COLUMN resolution text NOT NULL DEFAULT '720p'
CHECK (resolution IN ('360p', '720p', '1080p', '4k'));

COMMENT ON COLUMN public.clips.resolution IS 'Requested final video export resolution.';