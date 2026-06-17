import { PublishedTourManifestSchema } from "@wanderkit/shared";

export const sampleTourManifest = PublishedTourManifestSchema.parse({
  schemaVersion: 1,
  tourId: "tour-old-town",
  publishId: "pub-old-town-001",
  tourCode: "OLDTOWN",
  title: "Old Town Loop",
  description: "A short route through civic landmarks and quiet side streets.",
  city: "Victoria",
  countryCode: "CA",
  locale: "en",
  route: [
    { latitude: 48.4284, longitude: -123.3656 },
    { latitude: 48.4292, longitude: -123.3671 },
    { latitude: 48.4301, longitude: -123.3652 }
  ],
  stops: [
    {
      id: "stop-1",
      number: 1,
      title: "Market Square",
      summary: "Start among brick lanes and restored storefronts.",
      coordinate: { latitude: 48.4284, longitude: -123.3656 },
      audioUrl:
        "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
      audioDurationSeconds: 142,
      transcript:
        "Market Square anchors this walk with brick lanes, courtyards, and restored storefronts."
    },
    {
      id: "stop-2",
      number: 2,
      title: "Johnson Street",
      summary: "Look up for cast-iron details and painted cornices.",
      coordinate: { latitude: 48.4292, longitude: -123.3671 },
      audioUrl:
        "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
      audioDurationSeconds: 118,
      transcript:
        "Johnson Street rewards a slower pace with details tucked above the storefront line."
    },
    {
      id: "stop-3",
      number: 3,
      title: "Harbor Edge",
      summary: "End with the working waterfront in view.",
      coordinate: { latitude: 48.4301, longitude: -123.3652 },
      audioUrl:
        "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
      audioDurationSeconds: 156,
      transcript:
        "The harbor edge closes the loop where visitor paths and working waterfront routines overlap."
    }
  ],
  publishedAt: "2026-06-16T18:00:00.000Z",
  contentHash: "sha256-demo-oldtown-audio-v2"
});
