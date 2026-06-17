import { z } from "zod";

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

export const CoordinateSchema = z.object({
  latitude: z.number().gte(-90).lte(90),
  longitude: z.number().gte(-180).lte(180)
});

export type Coordinate = z.infer<typeof CoordinateSchema>;

export const TourStatusSchema = z.enum(["draft", "published", "archived"]);

export type TourStatus = z.infer<typeof TourStatusSchema>;

export const AudioMimeTypeSchema = z
  .string()
  .regex(/^audio\/[a-z0-9.+-]+$/i);

export const AudioAssetMetadataSchema = z.object({
  audioStoragePath: z.string().min(1).optional(),
  audioFileName: z.string().min(1).max(200).optional(),
  audioMimeType: AudioMimeTypeSchema.optional(),
  audioCredit: z.string().max(200).optional(),
  audioLicense: z.string().max(100).optional()
});

export type AudioAssetMetadata = z.infer<typeof AudioAssetMetadataSchema>;

export const StopSchema = z.object({
  id: z.string().min(1),
  tourId: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().max(500).optional(),
  body: z.string().optional(),
  coordinate: CoordinateSchema,
  audioAssetPath: z.string().min(1).optional(),
  audioDurationSeconds: z.number().nonnegative().optional()
}).merge(AudioAssetMetadataSchema);

export type Stop = z.infer<typeof StopSchema>;

export const RouteSchema = z.object({
  id: z.string().min(1),
  tourId: z.string().min(1),
  line: z.array(CoordinateSchema).min(2),
  distanceMeters: z.number().nonnegative().optional(),
  estimatedDurationMinutes: z.number().nonnegative().optional()
});

export type Route = z.infer<typeof RouteSchema>;

export const TourSchema = z.object({
  id: z.string().min(1),
  creatorId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  city: z.string().min(1),
  countryCode: z.string().length(2).optional(),
  locale: z.string().min(2).default("en"),
  status: TourStatusSchema,
  route: RouteSchema,
  stops: z.array(StopSchema).min(1),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema
});

export type Tour = z.infer<typeof TourSchema>;

export const PublishedStopSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().max(500).optional(),
  coordinate: CoordinateSchema,
  audioUrl: z.string().url(),
  audioDurationSeconds: z.number().nonnegative().optional(),
  transcript: z.string().optional()
}).merge(AudioAssetMetadataSchema);

export type PublishedStop = z.infer<typeof PublishedStopSchema>;

export const PublishedTourManifestSchema = z.object({
  schemaVersion: z.literal(1),
  tourId: z.string().min(1),
  publishId: z.string().min(1),
  tourCode: z.string().min(4).max(16).regex(/^[A-Z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().min(1),
  city: z.string().min(1),
  countryCode: z.string().length(2).optional(),
  locale: z.string().min(2),
  route: z.array(CoordinateSchema).min(2),
  stops: z.array(PublishedStopSchema).min(1),
  publishedAt: IsoDateTimeSchema,
  contentHash: z.string().min(1)
});

export type PublishedTourManifest = z.infer<typeof PublishedTourManifestSchema>;

export function parsePublishedTourManifest(
  value: unknown
): PublishedTourManifest {
  return PublishedTourManifestSchema.parse(value);
}
