-- Acostudio ai — schéma complet pour projet Supabase hjjzwyxneekwhwhwqeih
-- Idempotent autant que possible. À exécuter dans SQL Editor (Dashboard → SQL).

-- ========== Storage bucket ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('videos', 'videos', false, 524288000, ARRAY['video/mp4', 'video/webm']::text[])
ON CONFLICT (id) DO NOTHING;

-- ========== clips ==========
CREATE TABLE IF NOT EXISTS public.clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id text NOT NULL,
  scene text NOT NULL,
  prompt text NOT NULL,
  format text NOT NULL,
  duration int NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS resolution text NOT NULL DEFAULT '720p';
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS music_brief text;
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS style_preset text;
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.clips ADD COLUMN IF NOT EXISTS share_token text;
DO $$ BEGIN
  ALTER TABLE public.clips ADD CONSTRAINT clips_resolution_check
    CHECK (resolution IN ('360p', '720p', '1080p', '4k'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.clips ADD CONSTRAINT clips_share_token_key UNIQUE (share_token);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clips TO authenticated;
GRANT ALL ON public.clips TO service_role;
ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "own clips select" ON public.clips FOR SELECT TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own clips insert" ON public.clips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own clips update" ON public.clips FOR UPDATE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own clips delete" ON public.clips FOR DELETE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS clips_user_idx ON public.clips(user_id, created_at DESC);

-- ========== storyboards ==========
CREATE TABLE IF NOT EXISTS public.storyboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  idea text NOT NULL,
  title text NOT NULL,
  logline text NOT NULL,
  format text NOT NULL DEFAULT '16:9',
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.storyboards TO authenticated;
GRANT ALL ON public.storyboards TO service_role;
ALTER TABLE public.storyboards ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "own sb select" ON public.storyboards FOR SELECT TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own sb insert" ON public.storyboards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own sb delete" ON public.storyboards FOR DELETE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== projects ==========
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'violet',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "own projects select" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own projects insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own projects update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own projects delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.clips
    ADD CONSTRAINT clips_project_id_fkey
    FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS clips_project_idx ON public.clips(project_id);

-- ========== roles & config ==========
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  is_secret boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_config TO service_role;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_email text NOT NULL DEFAULT '',
  category text NOT NULL,
  action text NOT NULL,
  target text NOT NULL DEFAULT '',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);

-- Bootstrap admin after first signup (replace email). See AGENTS.md § Bootstrap admin.
-- Enable MFA on the Auth user in the Supabase dashboard when available.
-- INSERT INTO public.user_roles (user_id, role)
-- SELECT id, 'admin'::public.app_role FROM auth.users WHERE lower(email) = 'votre@email.com'
-- ON CONFLICT DO NOTHING;

-- ========== usage_counters ==========
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

-- ========== Storage RLS ==========
DO $$ BEGIN CREATE POLICY "own videos read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own videos write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own videos update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "own videos delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
