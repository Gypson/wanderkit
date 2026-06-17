insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000101',
  'authenticated',
  'authenticated',
  'demo-creator@wanderkit.test',
  crypt('wanderkit-demo-password', gen_salt('bf')),
  '2026-06-16T18:00:00.000Z',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Demo Creator"}'::jsonb,
  '2026-06-16T18:00:00.000Z',
  '2026-06-16T18:00:00.000Z',
  '',
  '',
  '',
  ''
)
on conflict (id) do update set
  email = excluded.email,
  updated_at = excluded.updated_at;

insert into public.creator_profiles (
  id,
  display_name,
  created_at
)
values (
  '00000000-0000-0000-0000-000000000101',
  'Demo Creator',
  '2026-06-16T18:00:00.000Z'
)
on conflict (id) do update set
  display_name = excluded.display_name;

insert into public.tours (
  id,
  creator_id,
  title,
  description,
  city,
  country_code,
  draft_tour_code,
  locale,
  status,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000101',
  'Old Town Loop',
  'A short route through civic landmarks and quiet side streets.',
  'Victoria',
  'CA',
  'OLDTOWN',
  'en',
  'published',
  '2026-06-16T18:00:00.000Z',
  '2026-06-16T18:00:00.000Z'
)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  city = excluded.city,
  country_code = excluded.country_code,
  draft_tour_code = excluded.draft_tour_code,
  locale = excluded.locale,
  status = excluded.status,
  updated_at = excluded.updated_at;

insert into public.tour_routes (
  id,
  tour_id,
  line,
  distance_meters,
  estimated_duration_minutes,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000201',
  '[
    {"latitude": 48.4284, "longitude": -123.3656},
    {"latitude": 48.4292, "longitude": -123.3671},
    {"latitude": 48.4301, "longitude": -123.3652}
  ]'::jsonb,
  750,
  35,
  '2026-06-16T18:00:00.000Z',
  '2026-06-16T18:00:00.000Z'
)
on conflict (tour_id) do update set
  line = excluded.line,
  distance_meters = excluded.distance_meters,
  estimated_duration_minutes = excluded.estimated_duration_minutes,
  updated_at = excluded.updated_at;

insert into public.tour_stops (
  id,
  tour_id,
  stop_number,
  title,
  summary,
  body,
  coordinate,
  audio_asset_path,
  audio_storage_path,
  audio_file_name,
  audio_mime_type,
  audio_credit,
  audio_license,
  audio_duration_seconds,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000201',
    1,
    'Market Square',
    'Start among brick lanes and restored storefronts.',
    'Market Square anchors the route with a compact mix of local shops, courtyards, and restored industrial brickwork.',
    '{"latitude": 48.4284, "longitude": -123.3656}'::jsonb,
    'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    'demo/oldtown/market-square.mp3',
    'market-square.mp3',
    'audio/mpeg',
    'WanderKit demo narration',
    'CC0 demo audio',
    142,
    '2026-06-16T18:00:00.000Z',
    '2026-06-16T18:00:00.000Z'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000201',
    2,
    'Johnson Street',
    'Look up for cast-iron details and painted cornices.',
    'Johnson Street shows how commercial streets changed as the city grew, with details that reward a slow walk.',
    '{"latitude": 48.4292, "longitude": -123.3671}'::jsonb,
    'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    'demo/oldtown/johnson-street.mp3',
    'johnson-street.mp3',
    'audio/mpeg',
    'WanderKit demo narration',
    'CC0 demo audio',
    118,
    '2026-06-16T18:00:00.000Z',
    '2026-06-16T18:00:00.000Z'
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000201',
    3,
    'Harbor Edge',
    'End with the working waterfront in view.',
    'The final stop opens the route back toward the harbor, where visitor foot traffic and working waterfront routines overlap.',
    '{"latitude": 48.4301, "longitude": -123.3652}'::jsonb,
    'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3',
    'demo/oldtown/harbor-edge.mp3',
    'harbor-edge.mp3',
    'audio/mpeg',
    'WanderKit demo narration',
    'CC0 demo audio',
    156,
    '2026-06-16T18:00:00.000Z',
    '2026-06-16T18:00:00.000Z'
  )
on conflict (tour_id, stop_number) do update set
  title = excluded.title,
  summary = excluded.summary,
  body = excluded.body,
  coordinate = excluded.coordinate,
  audio_asset_path = excluded.audio_asset_path,
  audio_storage_path = excluded.audio_storage_path,
  audio_file_name = excluded.audio_file_name,
  audio_mime_type = excluded.audio_mime_type,
  audio_credit = excluded.audio_credit,
  audio_license = excluded.audio_license,
  audio_duration_seconds = excluded.audio_duration_seconds,
  updated_at = excluded.updated_at;

insert into public.published_tour_manifests (
  id,
  tour_id,
  publish_version,
  tour_code,
  manifest,
  content_hash,
  published_at
)
values (
  '00000000-0000-0000-0000-000000000501',
  '00000000-0000-0000-0000-000000000201',
  1,
  'OLDTOWN',
  $manifest$
  {
    "schemaVersion": 1,
    "tourId": "00000000-0000-0000-0000-000000000201",
    "publishId": "00000000-0000-0000-0000-000000000501",
    "tourCode": "OLDTOWN",
    "title": "Old Town Loop",
    "description": "A short route through civic landmarks and quiet side streets.",
    "city": "Victoria",
    "countryCode": "CA",
    "locale": "en",
    "route": [
      { "latitude": 48.4284, "longitude": -123.3656 },
      { "latitude": 48.4292, "longitude": -123.3671 },
      { "latitude": 48.4301, "longitude": -123.3652 }
    ],
    "stops": [
      {
        "id": "00000000-0000-0000-0000-000000000401",
        "number": 1,
        "title": "Market Square",
        "summary": "Start among brick lanes and restored storefronts.",
        "coordinate": { "latitude": 48.4284, "longitude": -123.3656 },
        "audioUrl": "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
        "audioStoragePath": "demo/oldtown/market-square.mp3",
        "audioFileName": "market-square.mp3",
        "audioMimeType": "audio/mpeg",
        "audioCredit": "WanderKit demo narration",
        "audioLicense": "CC0 demo audio",
        "audioDurationSeconds": 142,
        "transcript": "Market Square anchors this walk with brick lanes, courtyards, and restored storefronts."
      },
      {
        "id": "00000000-0000-0000-0000-000000000402",
        "number": 2,
        "title": "Johnson Street",
        "summary": "Look up for cast-iron details and painted cornices.",
        "coordinate": { "latitude": 48.4292, "longitude": -123.3671 },
        "audioUrl": "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
        "audioStoragePath": "demo/oldtown/johnson-street.mp3",
        "audioFileName": "johnson-street.mp3",
        "audioMimeType": "audio/mpeg",
        "audioCredit": "WanderKit demo narration",
        "audioLicense": "CC0 demo audio",
        "audioDurationSeconds": 118,
        "transcript": "Johnson Street rewards a slower pace with details tucked above the storefront line."
      },
      {
        "id": "00000000-0000-0000-0000-000000000403",
        "number": 3,
        "title": "Harbor Edge",
        "summary": "End with the working waterfront in view.",
        "coordinate": { "latitude": 48.4301, "longitude": -123.3652 },
        "audioUrl": "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
        "audioStoragePath": "demo/oldtown/harbor-edge.mp3",
        "audioFileName": "harbor-edge.mp3",
        "audioMimeType": "audio/mpeg",
        "audioCredit": "WanderKit demo narration",
        "audioLicense": "CC0 demo audio",
        "audioDurationSeconds": 156,
        "transcript": "The harbor edge closes the loop where visitor paths and working waterfront routines overlap."
      }
    ],
    "publishedAt": "2026-06-16T18:00:00.000Z",
    "contentHash": "sha256-demo-oldtown-audio-v3"
  }
  $manifest$::jsonb,
  'sha256-demo-oldtown-audio-v3',
  '2026-06-16T18:00:00.000Z'
)
on conflict (tour_id, publish_version) do update set
  tour_code = excluded.tour_code,
  manifest = excluded.manifest,
  content_hash = excluded.content_hash,
  published_at = excluded.published_at;

insert into public.published_tour_manifests (
  id,
  tour_id,
  publish_version,
  tour_code,
  manifest,
  content_hash,
  published_at
)
values (
  '00000000-0000-0000-0000-000000000502',
  '00000000-0000-0000-0000-000000000201',
  2,
  'BADJSON',
  '{"schemaVersion": 1, "tourCode": "BADJSON", "title": "Broken Manifest"}'::jsonb,
  'sha256-invalid-demo',
  '2026-06-16T18:05:00.000Z'
)
on conflict (tour_id, publish_version) do update set
  tour_code = excluded.tour_code,
  manifest = excluded.manifest,
  content_hash = excluded.content_hash,
  published_at = excluded.published_at;
