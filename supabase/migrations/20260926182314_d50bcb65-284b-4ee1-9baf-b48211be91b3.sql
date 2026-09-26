CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT 'violet',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects select" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own projects insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own projects update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own projects delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

ALTER TABLE public.clips ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;
ALTER TABLE public.clips ADD COLUMN share_token text UNIQUE;
CREATE INDEX clips_project_idx ON public.clips(project_id);

CREATE POLICY "own videos update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text);