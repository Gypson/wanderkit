# MVP Scope

WanderKit starts with the tour engine needed to create, publish, and consume self-guided walking tours.

## Included

- Creator Studio web app for creating map-based walking tours.
- Stops with coordinates, numbers, titles, descriptions, and audio asset references.
- An editable route line made from ordered coordinates.
- Publish flow that creates a frozen JSON manifest.
- Publish history for saved manifests.
- Mobile app tour-code entry.
- Mobile route and stop display.
- Manual stop selection.
- Audio playback for selected stops.
- Supabase persistence for drafts and published manifests.
- Supabase Storage upload for stop audio.

## Excluded

- Payments
- Marketplace browsing
- Ratings and reviews
- Turn-by-turn navigation
- GPS-gated unlocking
- Creator payouts
- Promotional pages
- Social features

## Core Constraints

- City tours use coordinates, numbered pins, and a route line.
- Route coordinates are editable separately from numbered audio stops.
- Visitors can tap any stop at any time.
- A published manifest is immutable. Updates require publishing a new manifest version.
- Mobile consumes the published manifest, not draft editor tables.
- Hosted audio URLs are required for publishing. Studio can upload stop audio to Supabase Storage and write the resulting public URL into the draft.
