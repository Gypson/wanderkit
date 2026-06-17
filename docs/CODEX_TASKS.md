# Codex Tasks

Use this list to keep early work sequenced.

## Foundation

- Keep `pnpm install` and `pnpm typecheck` green.
- Expand shared schemas before app-specific copies appear.
- Add generated Supabase database types after the first live project is linked.

## Creator Studio

- Add audio waveform preview.

## Mobile

- Add offline UX polish and retry controls.

## Completed Foundation Slices

- Added Supabase manifest lookup by tour code in the mobile app.
- Added seeded `OLDTOWN` and `BADJSON` published manifest rows.
- Added generated-style Supabase database types for the initial schema.
- Added mobile stop detail screens with Expo Audio playback controls.
- Added mobile map rendering with route polyline, numbered stop pins, and pin-to-audio navigation.
- Added mobile AsyncStorage manifest caching with cached/offline fallback.
- Added mobile downloaded audio caching for stop playback.
- Added mobile offline cache management controls.
- Added Creator Studio draft editor, stop rows, manifest preview, Supabase draft save, and manifest publish validation.
- Added Creator Studio saved draft list/loading, New Draft, and list refresh after save/publish.
- Added explicit Creator Studio route line editing with separate route persistence.
- Added Creator Studio publish history for frozen manifest versions.
- Added Creator Studio audio asset reference metadata for hosted audio.
- Added server-side Supabase Storage upload flow for stop audio.
- Added browser-side audio duration extraction during Studio upload.
- Added atomic publish RPC for manifest version insertion and tour publish status.
- Added database-computed manifest content hashing and fetch-time hash checks.
- Hardened published manifest RLS, database constraints, and immutability trigger.
- Updated local seed manifests to compute hashes through the database helper.
- Added local Supabase CLI config, alternate Windows-safe ports, and smoke test.

## Backend

- Add an authenticated creator session model to replace the demo creator id.
