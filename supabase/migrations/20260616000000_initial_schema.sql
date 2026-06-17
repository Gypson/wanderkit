create extension if not exists pgcrypto;

create table public.creator_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.tours (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  title text not null,
  description text not null,
  city text not null,
  country_code text,
  draft_tour_code text,
  locale text not null default 'en',
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tour_routes (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null unique references public.tours(id) on delete cascade,
  line jsonb not null,
  distance_meters numeric,
  estimated_duration_minutes numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tour_stops (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete cascade,
  stop_number integer not null check (stop_number > 0),
  title text not null,
  summary text,
  body text,
  coordinate jsonb not null,
  audio_asset_path text,
  audio_storage_path text,
  audio_file_name text,
  audio_mime_type text check (
    audio_mime_type is null
    or audio_mime_type ~* '^audio/[a-z0-9.+-]+$'
  ),
  audio_credit text,
  audio_license text,
  audio_duration_seconds numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tour_id, stop_number)
);

create table public.published_tour_manifests (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references public.tours(id) on delete restrict,
  publish_version integer not null,
  tour_code text not null,
  manifest jsonb not null,
  content_hash text not null,
  published_at timestamptz not null default now(),
  unique (tour_id, publish_version)
);

alter table public.creator_profiles enable row level security;
alter table public.tours enable row level security;
alter table public.tour_routes enable row level security;
alter table public.tour_stops enable row level security;
alter table public.published_tour_manifests enable row level security;

create policy "Creators can read their profile"
  on public.creator_profiles
  for select
  using (auth.uid() = id);

create policy "Creators can manage their profile"
  on public.creator_profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Creators can manage their tours"
  on public.tours
  for all
  using (auth.uid() = creator_id)
  with check (auth.uid() = creator_id);

create policy "Creators can manage their routes"
  on public.tour_routes
  for all
  using (
    exists (
      select 1
      from public.tours
      where tours.id = tour_routes.tour_id
        and tours.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tours
      where tours.id = tour_routes.tour_id
        and tours.creator_id = auth.uid()
    )
  );

create policy "Creators can manage their stops"
  on public.tour_stops
  for all
  using (
    exists (
      select 1
      from public.tours
      where tours.id = tour_stops.tour_id
        and tours.creator_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.tours
      where tours.id = tour_stops.tour_id
        and tours.creator_id = auth.uid()
    )
  );

create policy "Published manifests are public"
  on public.published_tour_manifests
  for select
  using (true);

create index published_tour_manifests_tour_code_idx
  on public.published_tour_manifests (tour_code);

create index tour_stops_tour_id_stop_number_idx
  on public.tour_stops (tour_id, stop_number);
