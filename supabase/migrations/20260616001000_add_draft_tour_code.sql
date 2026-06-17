alter table public.tours
  add column if not exists draft_tour_code text;

