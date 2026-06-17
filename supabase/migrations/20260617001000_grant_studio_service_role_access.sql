grant usage on schema public
  to anon, authenticated, service_role;

grant select on public.published_tour_manifests
  to anon, authenticated;

grant select, insert, update, delete on
  public.creator_profiles,
  public.tours,
  public.tour_routes,
  public.tour_stops,
  public.published_tour_manifests
  to service_role;
