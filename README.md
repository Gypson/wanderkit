# WanderKit

WanderKit is a self-guided city tour marketplace. This repository starts with the MVP tour engine, not the full marketplace.

## MVP Apps

- `apps/studio`: Creator Studio for building map-based walking tours.
- `apps/mobile`: Expo app where visitors enter a tour code, view a route, tap stops, and play audio.
- `packages/shared`: Shared TypeScript types and Zod schemas.
- `packages/supabase`: Supabase client helpers shared across apps.
- `supabase/migrations`: Database migrations.
- `docs`: Product and engineering notes.

## What Is Deliberately Out Of Scope

- Payments
- Marketplace browsing
- Ratings and reviews
- Turn-by-turn navigation
- GPS-gated unlocking

Visitors can manually tap any numbered stop. Published tours are frozen JSON manifests consumed by the mobile app.

## Getting Started

```bash
pnpm install
pnpm typecheck
```

Start Creator Studio:

```bash
pnpm dev:studio
```

Start the Expo app:

```bash
pnpm dev:mobile
```

Copy `.env.example` to `.env.local` for Studio and to your Expo environment when connecting to Supabase.

## Local Supabase

The repo is configured for the Supabase CLI. Local ports use `5542x` because some Windows setups reserve Supabase's default Postgres port range.

```bash
pnpm supabase:start
pnpm supabase:reset
pnpm supabase:smoke
```

Useful local URLs:

- API: `http://127.0.0.1:55421`
- Database: `postgresql://postgres:postgres@127.0.0.1:55422/postgres`
- Supabase Studio: `http://127.0.0.1:55423`
- Email tester: `http://127.0.0.1:55424`

Run `pnpm supabase:status` to print the local anon and service-role keys for `.env.local`.

## Supabase Seed Data

The repo includes `supabase/seed.sql` for local development. After running migrations and seed data with the Supabase CLI, the mobile app can exercise these tour-code states:

- `OLDTOWN`: valid published manifest.
- `BADJSON`: row exists, but manifest validation fails.
- Any other code: not found.

In the mobile app, open `OLDTOWN`, view the route line and numbered pins on the map, tap a pin or a stop's `Play` button, and the stop detail screen will load the stop audio from the published manifest.

The mobile app caches each valid manifest after a successful lookup. If Supabase configuration is missing or a later network lookup fails, the last cached copy for that tour code can still render the route and stop audio with a cached/offline notice. Stop detail screens also download audio into app storage for offline replay after the first successful load. The entry screen includes offline cache controls for viewing saved tour/audio counts and clearing local offline data.

The mobile map uses `react-native-maps`. Expo Go works without extra setup for this MVP. Production Google Maps builds may need platform API keys later.

Set these Expo variables before running the mobile app against Supabase:

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

Creator Studio can edit drafts locally without Supabase. To save draft rows, upload audio files, and publish manifest rows to Supabase, set:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55421
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
STUDIO_AUDIO_BUCKET=tour-audio
STUDIO_DEMO_CREATOR_ID=00000000-0000-0000-0000-000000000101
```

The demo creator id matches `supabase/seed.sql`.

With those server env vars configured, Studio also loads saved drafts from Supabase, lets creators select a draft, uploads stop audio to the public `tour-audio` Storage bucket, edits the route line separately from numbered audio stops, stores audio asset reference metadata, shows publish history for frozen manifests, and refreshes the list after save or publish.

## Workspace Scripts

- `pnpm dev:studio`: starts the Next.js Creator Studio.
- `pnpm dev:mobile`: starts Expo.
- `pnpm supabase:start`: starts the local Supabase Docker stack.
- `pnpm supabase:reset`: applies migrations and seed data to the local database.
- `pnpm supabase:smoke`: verifies the seeded manifest lookup and immutability rules.
- `pnpm supabase:status`: prints local service URLs and keys.
- `pnpm supabase:stop`: stops the local Supabase stack.
- `pnpm typecheck`: type-checks every workspace package.
- `pnpm build`: runs package builds where available.
