alter table public.published_tour_manifests
  drop constraint if exists published_tour_manifests_tour_code_key;

create index if not exists published_tour_manifests_tour_code_version_idx
  on public.published_tour_manifests (tour_code, publish_version desc);

create or replace function public.publish_tour_manifest(
  p_tour_id uuid,
  p_creator_id uuid,
  p_tour_code text,
  p_manifest jsonb,
  p_content_hash text,
  p_published_at timestamptz
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_publish_version integer;
begin
  perform 1
  from public.tours
  where id = p_tour_id
    and creator_id = p_creator_id
  for update;

  if not found then
    raise exception 'Tour % was not found for creator %', p_tour_id, p_creator_id
      using errcode = 'P0002';
  end if;

  select coalesce(max(publish_version), 0) + 1
  into next_publish_version
  from public.published_tour_manifests
  where tour_id = p_tour_id;

  update public.tours
  set
    status = 'published',
    draft_tour_code = p_tour_code,
    updated_at = coalesce(p_published_at, now())
  where id = p_tour_id
    and creator_id = p_creator_id;

  insert into public.published_tour_manifests (
    tour_id,
    publish_version,
    tour_code,
    manifest,
    content_hash,
    published_at
  )
  values (
    p_tour_id,
    next_publish_version,
    p_tour_code,
    p_manifest,
    p_content_hash,
    coalesce(p_published_at, now())
  );

  return next_publish_version;
end;
$$;

revoke all on function public.publish_tour_manifest(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.publish_tour_manifest(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
) to service_role;
