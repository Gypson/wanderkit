create or replace function public.compute_manifest_content_hash(
  p_manifest jsonb
)
returns text
language sql
immutable
set search_path = public
as $$
  select 'sha256-' || encode(
    digest(jsonb_strip_nulls(p_manifest - 'contentHash')::text, 'sha256'),
    'hex'
  );
$$;

update public.published_tour_manifests
set manifest = jsonb_set(
  jsonb_set(manifest, '{tourId}', to_jsonb(tour_id::text), true),
  '{tourCode}',
  to_jsonb(tour_code),
  true
)
where manifest->>'tourId' is distinct from tour_id::text
  or manifest->>'tourCode' is distinct from tour_code;

update public.published_tour_manifests
set
  content_hash = public.compute_manifest_content_hash(manifest),
  manifest = jsonb_set(
    manifest,
    '{contentHash}',
    to_jsonb(public.compute_manifest_content_hash(manifest)),
    true
  )
where content_hash is distinct from public.compute_manifest_content_hash(manifest)
  or manifest->>'contentHash' is distinct from public.compute_manifest_content_hash(manifest);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'published_tour_manifests_content_hash_format_check'
  ) then
    alter table public.published_tour_manifests
      add constraint published_tour_manifests_content_hash_format_check
      check (content_hash ~ '^sha256-[0-9a-f]{64}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'published_tour_manifests_manifest_identity_check'
  ) then
    alter table public.published_tour_manifests
      add constraint published_tour_manifests_manifest_identity_check
      check (
        manifest->>'tourId' = tour_id::text
        and manifest->>'tourCode' = tour_code
        and manifest->>'contentHash' = content_hash
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'published_tour_manifests_content_hash_matches_manifest_check'
  ) then
    alter table public.published_tour_manifests
      add constraint published_tour_manifests_content_hash_matches_manifest_check
      check (content_hash = public.compute_manifest_content_hash(manifest));
  end if;
end $$;

create or replace function public.is_public_published_tour(
  p_tour_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tours
    where id = p_tour_id
      and status = 'published'
  );
$$;

revoke all on function public.is_public_published_tour(uuid)
  from public, anon, authenticated;

grant execute on function public.is_public_published_tour(uuid)
  to anon, authenticated;

drop policy if exists "Published manifests are public"
  on public.published_tour_manifests;

drop policy if exists "Published manifests are public for published tours"
  on public.published_tour_manifests;

create policy "Published manifests are public for published tours"
  on public.published_tour_manifests
  for select
  to public
  using (public.is_public_published_tour(tour_id));

drop policy if exists "Creators can read their published manifests"
  on public.published_tour_manifests;

create policy "Creators can read their published manifests"
  on public.published_tour_manifests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tours
      where tours.id = published_tour_manifests.tour_id
        and tours.creator_id = auth.uid()
    )
  );

create or replace function public.prevent_published_manifest_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Published tour manifests are immutable.'
      using errcode = 'P0001';
  end if;

  if to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;

  raise exception 'Published tour manifests are immutable.'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists published_tour_manifests_are_immutable
  on public.published_tour_manifests;

create trigger published_tour_manifests_are_immutable
  before update or delete on public.published_tour_manifests
  for each row
  execute function public.prevent_published_manifest_mutation();

drop function if exists public.publish_tour_manifest(
  uuid,
  uuid,
  text,
  jsonb,
  text,
  timestamptz
);

create function public.publish_tour_manifest(
  p_tour_id uuid,
  p_creator_id uuid,
  p_tour_code text,
  p_manifest jsonb,
  p_content_hash text,
  p_published_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  final_manifest jsonb;
  next_publish_version integer;
  server_content_hash text;
begin
  if not p_manifest ? 'contentHash' then
    raise exception 'Manifest is missing contentHash.'
      using errcode = '22023';
  end if;

  if p_content_hash is distinct from p_manifest->>'contentHash' then
    raise exception 'Manifest contentHash does not match p_content_hash.'
      using errcode = '22023';
  end if;

  if p_manifest->>'tourId' is distinct from p_tour_id::text then
    raise exception 'Manifest tourId does not match p_tour_id.'
      using errcode = '22023';
  end if;

  if p_manifest->>'tourCode' is distinct from p_tour_code then
    raise exception 'Manifest tourCode does not match p_tour_code.'
      using errcode = '22023';
  end if;

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

  server_content_hash := public.compute_manifest_content_hash(p_manifest);
  final_manifest := jsonb_set(
    p_manifest,
    '{contentHash}',
    to_jsonb(server_content_hash),
    true
  );

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
    final_manifest,
    server_content_hash,
    coalesce(p_published_at, now())
  );

  return jsonb_build_object(
    'publishVersion', next_publish_version,
    'contentHash', server_content_hash,
    'manifest', final_manifest
  );
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
