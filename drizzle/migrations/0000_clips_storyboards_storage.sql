create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  job_id text not null,
  scene text not null,
  prompt text not null,
  format text not null,
  duration int not null,
  status text not null default 'pending',
  error text,
  storage_path text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clips to authenticated;
grant all on public.clips to service_role;
alter table public.clips enable row level security;
do $$ begin
  create policy "own clips select" on public.clips for select to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own clips insert" on public.clips for insert to authenticated with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own clips update" on public.clips for update to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own clips delete" on public.clips for delete to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
create index if not exists clips_user_idx on public.clips(user_id, created_at desc);

create table if not exists public.storyboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  idea text not null,
  title text not null,
  logline text not null,
  format text not null default '16:9',
  scenes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.storyboards to authenticated;
grant all on public.storyboards to service_role;
alter table public.storyboards enable row level security;
do $$ begin
  create policy "own sb select" on public.storyboards for select to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own sb insert" on public.storyboards for insert to authenticated with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own sb delete" on public.storyboards for delete to authenticated using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "own videos read" on storage.objects for select to authenticated using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own videos write" on storage.objects for insert to authenticated with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "own videos delete" on storage.objects for delete to authenticated using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
exception when duplicate_object then null; end $$;