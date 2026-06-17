alter table public.tour_stops
  add column if not exists audio_storage_path text,
  add column if not exists audio_file_name text,
  add column if not exists audio_mime_type text,
  add column if not exists audio_credit text,
  add column if not exists audio_license text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tour_stops_audio_mime_type_check'
  ) then
    alter table public.tour_stops
      add constraint tour_stops_audio_mime_type_check
      check (
        audio_mime_type is null
        or audio_mime_type ~* '^audio/[a-z0-9.+-]+$'
      );
  end if;
end $$;
