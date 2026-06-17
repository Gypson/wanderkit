import { z } from "zod";
import {
  AudioAssetMetadataSchema,
  CoordinateSchema,
  PublishedTourManifestSchema,
  type PublishedTourManifest
} from "./tour";

export const StudioDraftStopSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().max(500).optional(),
  coordinate: CoordinateSchema,
  audioUrl: z.string().url(),
  audioDurationSeconds: z.number().nonnegative().optional(),
  transcript: z.string().optional()
}).merge(AudioAssetMetadataSchema);

export type StudioDraftStop = z.infer<typeof StudioDraftStopSchema>;

export const StudioDraftTourSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  city: z.string().min(1),
  countryCode: z.string().length(2).optional(),
  locale: z.string().min(2).default("en"),
  tourCode: z.string().min(4).max(16).regex(/^[A-Z0-9-]+$/),
  route: z.array(CoordinateSchema).min(2),
  stops: z.array(StudioDraftStopSchema).min(2)
});

export type StudioDraftTour = z.infer<typeof StudioDraftTourSchema>;

export type BuildPublishedManifestOptions = {
  contentHash: string;
  publishedAt: string;
  publishId: string;
};

export function buildPublishedTourManifestFromDraft(
  draft: StudioDraftTour,
  { contentHash, publishedAt, publishId }: BuildPublishedManifestOptions
): PublishedTourManifest {
  return PublishedTourManifestSchema.parse({
    schemaVersion: 1,
    tourId: draft.id,
    publishId,
    tourCode: draft.tourCode,
    title: draft.title,
    description: draft.description,
    city: draft.city,
    countryCode: draft.countryCode,
    locale: draft.locale,
    route: draft.route,
    stops: draft.stops.map((stop, index) => ({
      id: stop.id,
      number: index + 1,
      title: stop.title,
      summary: stop.summary,
      coordinate: stop.coordinate,
      audioUrl: stop.audioUrl,
      audioDurationSeconds: stop.audioDurationSeconds,
      audioStoragePath: stop.audioStoragePath,
      audioFileName: stop.audioFileName,
      audioMimeType: stop.audioMimeType,
      audioCredit: stop.audioCredit,
      audioLicense: stop.audioLicense,
      transcript: stop.transcript
    })),
    publishedAt,
    contentHash
  });
}
