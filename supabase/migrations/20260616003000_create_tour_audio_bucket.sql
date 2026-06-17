insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'tour-audio',
  'tour-audio',
  true,
  52428800,
  array[
    'audio/aac',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'audio/x-m4a'
  ]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Tour audio is publicly readable"
  on storage.objects;

create policy "Tour audio is publicly readable"
  on storage.objects
  for select
  to public
  using (bucket_id = 'tour-audio');
