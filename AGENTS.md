# AGENTS.md

This repo is the WanderKit MVP tour engine. Keep changes focused on the creator workflow, published manifest pipeline, mobile code entry, route display, stop selection, and audio playback.

## Product Boundaries

Do not add payments, marketplace browsing, ratings, reviews, turn-by-turn navigation, or GPS-gated unlocking unless the scope document changes. Visitors can tap any stop manually.

## Architecture Rules

- Shared tour contracts live in `packages/shared`.
- Supabase client helpers live in `packages/supabase`.
- Studio publishes immutable JSON manifests for mobile consumption.
- Mobile should consume published manifests by tour code.
- Prefer Zod parsing at app boundaries before trusting manifest JSON.

## Commands

```bash
pnpm install
pnpm typecheck
pnpm dev:studio
pnpm dev:mobile
```

## Implementation Notes

- Use pnpm workspace dependencies with `workspace:*`.
- Keep generated or build output out of Git.
- Keep docs updated when changing MVP scope or architecture.
- Keep starter apps compiling before adding product depth.

