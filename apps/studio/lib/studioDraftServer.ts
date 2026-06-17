import {
  buildPublishedTourManifestFromDraft,
  CoordinateSchema,
  PublishedTourManifestSchema,
  StudioDraftTourSchema,
  type Coordinate,
  type PublishedTourManifest,
  type StudioDraftStop,
  type StudioDraftTour
} from "@wanderkit/shared";
import {
  createWanderKitSupabaseServiceClient,
  getOptionalSupabaseServiceConfig,
  type Json,
  type WanderKitSupabaseClient
} from "@wanderkit/supabase";
import { createHash, randomUUID } from "node:crypto";

const DEFAULT_CREATOR_ID = "00000000-0000-0000-0000-000000000101";
const DEFAULT_AUDIO_BUCKET = "tour-audio";
const MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/aac",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/x-m4a"
]);

export type StudioPersistenceResult =
  | {
      message: string;
      status: "local-only";
    }
  | {
      message: string;
      status: "saved";
      tourId: string;
    };

export type StudioPublishResult =
  | {
      manifest: PublishedTourManifest;
      message: string;
      status: "validated";
    }
  | {
      manifest: PublishedTourManifest;
      message: string;
      publishVersion: number;
      status: "published";
    };

export type StudioDraftSummary = {
  city: string;
  id: string;
  status: "draft" | "published" | "archived";
  stopCount: number;
  title: string;
  tourCode: string;
  updatedAt: string;
};

export type StudioPublishHistoryItem = {
  contentHash: string;
  id: string;
  publishedAt: string;
  publishVersion: number;
  tourCode: string;
};

export type StudioDraftListResult =
  | {
      drafts: StudioDraftSummary[];
      message: string;
      status: "local-only";
    }
  | {
      drafts: StudioDraftSummary[];
      message: string;
      status: "loaded";
    };

export type StudioDraftLoadResult =
  | {
      draft: StudioDraftTour;
      message: string;
      status: "loaded";
    }
  | {
      message: string;
      status: "local-only";
    };

export type StudioPublishHistoryResult =
  | {
      history: StudioPublishHistoryItem[];
      message: string;
      status: "local-only";
    }
  | {
      history: StudioPublishHistoryItem[];
      message: string;
      status: "loaded";
    };

export type StudioAudioUploadResult =
  | {
      message: string;
      status: "local-only";
    }
  | {
      audioFileName: string;
      audioMimeType: string;
      audioSizeBytes: number;
      audioStoragePath: string;
      audioUrl: string;
      message: string;
      status: "uploaded";
    };

export function parseStudioDraftPayload(value: unknown): StudioDraftTour {
  return StudioDraftTourSchema.parse(value);
}

export function getStudioServiceClient(): WanderKitSupabaseClient | null {
  const config = getOptionalSupabaseServiceConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  });

  if (!config) {
    return null;
  }

  return createWanderKitSupabaseServiceClient(config);
}

export async function saveStudioDraft(
  draft: StudioDraftTour
): Promise<StudioPersistenceResult> {
  const client = getStudioServiceClient();

  if (!client) {
    return {
      status: "local-only",
      message:
        "Draft is valid. Configure Supabase server env vars to persist it."
    };
  }

  await persistStudioDraft(client, draft, "draft");

  return {
    status: "saved",
    message: "Draft saved to Supabase.",
    tourId: draft.id
  };
}

export async function listStudioDrafts(): Promise<StudioDraftListResult> {
  const client = getStudioServiceClient();

  if (!client) {
    return {
      status: "local-only",
      message:
        "Configure Supabase server env vars to load saved Studio drafts.",
      drafts: []
    };
  }

  const creatorId = process.env.STUDIO_DEMO_CREATOR_ID ?? DEFAULT_CREATOR_ID;
  const { data: tours, error: toursError } = await client
    .from("tours")
    .select("id,title,city,status,updated_at,draft_tour_code")
    .eq("creator_id", creatorId)
    .order("updated_at", { ascending: false });

  if (toursError) {
    throw new Error(toursError.message);
  }

  const tourIds = tours.map((tour) => tour.id);
  const stopCountsByTourId = new Map<string, number>();

  if (tourIds.length > 0) {
    const { data: stops, error: stopsError } = await client
      .from("tour_stops")
      .select("tour_id")
      .in("tour_id", tourIds);

    if (stopsError) {
      throw new Error(stopsError.message);
    }

    for (const stop of stops) {
      stopCountsByTourId.set(
        stop.tour_id,
        (stopCountsByTourId.get(stop.tour_id) ?? 0) + 1
      );
    }
  }

  return {
    status: "loaded",
    message: `Loaded ${tours.length} saved draft${tours.length === 1 ? "" : "s"}.`,
    drafts: tours.map((tour) => ({
      id: tour.id,
      title: tour.title,
      city: tour.city,
      status: tour.status,
      updatedAt: tour.updated_at,
      tourCode: tour.draft_tour_code ?? "",
      stopCount: stopCountsByTourId.get(tour.id) ?? 0
    }))
  };
}

export async function loadStudioDraft(
  tourId: string
): Promise<StudioDraftLoadResult> {
  const client = getStudioServiceClient();

  if (!client) {
    return {
      status: "local-only",
      message:
        "Configure Supabase server env vars to load saved Studio drafts."
    };
  }

  const creatorId = process.env.STUDIO_DEMO_CREATOR_ID ?? DEFAULT_CREATOR_ID;
  const { data: tour, error: tourError } = await client
    .from("tours")
    .select("id,title,description,city,country_code,draft_tour_code,locale")
    .eq("id", tourId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (tourError) {
    throw new Error(tourError.message);
  }

  if (!tour) {
    throw new Error("Draft was not found.");
  }

  const { data: stops, error: stopsError } = await client
    .from("tour_stops")
    .select(
      "id,title,summary,coordinate,audio_asset_path,audio_storage_path,audio_file_name,audio_mime_type,audio_credit,audio_license,audio_duration_seconds,body,stop_number"
    )
    .eq("tour_id", tour.id)
    .order("stop_number", { ascending: true });

  if (stopsError) {
    throw new Error(stopsError.message);
  }

  const { data: route, error: routeError } = await client
    .from("tour_routes")
    .select("line")
    .eq("tour_id", tour.id)
    .maybeSingle();

  if (routeError) {
    throw new Error(routeError.message);
  }

  const draftStops = stops.map(
    (stop): StudioDraftStop => ({
      id: stop.id,
      title: stop.title,
      summary: stop.summary ?? undefined,
      coordinate: parseJsonCoordinate(stop.coordinate),
      audioUrl: stop.audio_asset_path ?? DEMO_AUDIO_URL,
      audioStoragePath: stop.audio_storage_path ?? undefined,
      audioFileName: stop.audio_file_name ?? undefined,
      audioMimeType: stop.audio_mime_type ?? undefined,
      audioCredit: stop.audio_credit ?? undefined,
      audioLicense: stop.audio_license ?? undefined,
      audioDurationSeconds:
        stop.audio_duration_seconds === null
          ? undefined
          : Number(stop.audio_duration_seconds),
      transcript: stop.body ?? undefined
    })
  );

  const draft = StudioDraftTourSchema.parse({
    id: tour.id,
    title: tour.title,
    description: tour.description,
    city: tour.city,
    countryCode: tour.country_code ?? undefined,
    locale: tour.locale,
    tourCode:
      tour.draft_tour_code ??
      createFallbackTourCode(tour.title, tour.id),
    route: parseRouteLine(route?.line, draftStops),
    stops: draftStops
  });

  return {
    status: "loaded",
    message: `Loaded ${draft.title}.`,
    draft
  };
}

export async function listStudioPublishHistory(
  tourId: string
): Promise<StudioPublishHistoryResult> {
  const client = getStudioServiceClient();

  if (!client) {
    return {
      status: "local-only",
      message:
        "Configure Supabase server env vars to load publish history.",
      history: []
    };
  }

  const creatorId = process.env.STUDIO_DEMO_CREATOR_ID ?? DEFAULT_CREATOR_ID;
  const { data: tour, error: tourError } = await client
    .from("tours")
    .select("id")
    .eq("id", tourId)
    .eq("creator_id", creatorId)
    .maybeSingle();

  if (tourError) {
    throw new Error(tourError.message);
  }

  if (!tour) {
    throw new Error("Draft was not found.");
  }

  const { data: publishes, error: publishesError } = await client
    .from("published_tour_manifests")
    .select("id,publish_version,tour_code,published_at,content_hash")
    .eq("tour_id", tourId)
    .order("publish_version", { ascending: false });

  if (publishesError) {
    throw new Error(publishesError.message);
  }

  return {
    status: "loaded",
    message: `Loaded ${publishes.length} publish${publishes.length === 1 ? "" : "es"}.`,
    history: publishes.map((publish) => ({
      id: publish.id,
      publishVersion: publish.publish_version,
      tourCode: publish.tour_code,
      publishedAt: publish.published_at,
      contentHash: publish.content_hash
    }))
  };
}

export async function uploadStudioStopAudio({
  file,
  stopId,
  tourId
}: {
  file: File;
  stopId: string;
  tourId: string;
}): Promise<StudioAudioUploadResult> {
  validateAudioUploadInput({ file, stopId, tourId });

  const client = getStudioServiceClient();

  if (!client) {
    return {
      status: "local-only",
      message:
        "Audio file is valid. Configure Supabase server env vars to upload it."
    };
  }

  const bucket = process.env.STUDIO_AUDIO_BUCKET ?? DEFAULT_AUDIO_BUCKET;
  const audioFileName = sanitizeFileName(file.name);
  const audioStoragePath = createAudioStoragePath({
    fileName: audioFileName,
    stopId,
    tourId
  });

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(audioStoragePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data } = client.storage.from(bucket).getPublicUrl(audioStoragePath);

  return {
    status: "uploaded",
    message: "Audio uploaded to Supabase Storage.",
    audioUrl: data.publicUrl,
    audioStoragePath,
    audioFileName,
    audioMimeType: file.type,
    audioSizeBytes: file.size
  };
}

export async function publishStudioDraft(
  draft: StudioDraftTour
): Promise<StudioPublishResult> {
  const manifestWithoutHash = buildPublishedTourManifestFromDraft(draft, {
    contentHash:
      "sha256-0000000000000000000000000000000000000000000000000000000000000000",
    publishedAt: new Date().toISOString(),
    publishId: randomUUID()
  });
  const contentHash = createManifestHash({
    ...manifestWithoutHash,
    contentHash: undefined
  });
  const manifest = buildPublishedTourManifestFromDraft(draft, {
    contentHash,
    publishedAt: manifestWithoutHash.publishedAt,
    publishId: manifestWithoutHash.publishId
  });
  const client = getStudioServiceClient();

  if (!client) {
    return {
      status: "validated",
      message:
        "Manifest is valid. Configure Supabase server env vars to publish it.",
      manifest
    };
  }

  await persistStudioDraft(client, draft, "draft");
  const creatorId = process.env.STUDIO_DEMO_CREATOR_ID ?? DEFAULT_CREATOR_ID;
  const { data: publishVersion, error } = await client.rpc(
    "publish_tour_manifest",
    {
      p_tour_id: draft.id,
      p_creator_id: creatorId,
      p_tour_code: manifest.tourCode,
      p_manifest: toJson(manifest),
      p_content_hash: manifest.contentHash,
      p_published_at: manifest.publishedAt
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const published = parsePublishTourManifestRpcResult(publishVersion);

  return {
    status: "published",
    message: `Published ${published.manifest.tourCode} to Supabase.`,
    manifest: published.manifest,
    publishVersion: published.publishVersion
  };
}

async function persistStudioDraft(
  client: WanderKitSupabaseClient,
  draft: StudioDraftTour,
  status: "draft" | "published"
) {
  const now = new Date().toISOString();
  const creatorId = process.env.STUDIO_DEMO_CREATOR_ID ?? DEFAULT_CREATOR_ID;

  const { error: tourError } = await client.from("tours").upsert({
    id: draft.id,
    creator_id: creatorId,
    title: draft.title,
    description: draft.description,
    city: draft.city,
    country_code: draft.countryCode ?? null,
    draft_tour_code: draft.tourCode,
    locale: draft.locale,
    status,
    updated_at: now
  });

  if (tourError) {
    throw new Error(tourError.message);
  }

  const { error: routeError } = await client
    .from("tour_routes")
    .upsert(
      {
        tour_id: draft.id,
        line: toJson(draft.route),
        updated_at: now
      },
      { onConflict: "tour_id" }
    );

  if (routeError) {
    throw new Error(routeError.message);
  }

  const { error: deleteStopsError } = await client
    .from("tour_stops")
    .delete()
    .eq("tour_id", draft.id);

  if (deleteStopsError) {
    throw new Error(deleteStopsError.message);
  }

  const { error: insertStopsError } = await client.from("tour_stops").insert(
    draft.stops.map((stop, index) => ({
      id: stop.id,
      tour_id: draft.id,
      stop_number: index + 1,
      title: stop.title,
      summary: stop.summary ?? null,
      coordinate: toJson(stop.coordinate),
      audio_asset_path: stop.audioUrl,
      audio_storage_path: stop.audioStoragePath ?? null,
      audio_file_name: stop.audioFileName ?? null,
      audio_mime_type: stop.audioMimeType ?? null,
      audio_credit: stop.audioCredit ?? null,
      audio_license: stop.audioLicense ?? null,
      audio_duration_seconds: stop.audioDurationSeconds ?? null,
      body: stop.transcript ?? null,
      updated_at: now
    }))
  );

  if (insertStopsError) {
    throw new Error(insertStopsError.message);
  }
}

function createManifestHash(value: unknown): string {
  const json = JSON.stringify(value);
  return `sha256-${createHash("sha256").update(json).digest("hex")}`;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

function parsePublishTourManifestRpcResult(value: Json | null): {
  contentHash: string;
  manifest: PublishedTourManifest;
  publishVersion: number;
} {
  if (!isRecord(value)) {
    throw new Error("Publish did not return a manifest result.");
  }

  const publishVersion = value.publishVersion;
  if (typeof publishVersion !== "number") {
    throw new Error("Publish did not return a version.");
  }

  const contentHash = value.contentHash;
  if (typeof contentHash !== "string") {
    throw new Error("Publish did not return a content hash.");
  }

  const manifest = PublishedTourManifestSchema.parse(value.manifest);
  if (manifest.contentHash !== contentHash) {
    throw new Error("Published manifest hash does not match RPC result.");
  }

  return {
    contentHash,
    manifest,
    publishVersion
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonCoordinate(value: Json): Coordinate {
  return CoordinateSchema.parse(value);
}

function parseRouteLine(
  value: Json | null | undefined,
  stops: StudioDraftStop[]
): Coordinate[] {
  const fallbackRoute = stops.map((stop) => stop.coordinate);

  if (value === null || value === undefined) {
    return fallbackRoute;
  }

  const parsed = StudioDraftTourSchema.shape.route.safeParse(value);

  return parsed.success ? parsed.data : fallbackRoute;
}

function validateAudioUploadInput({
  file,
  stopId,
  tourId
}: {
  file: File;
  stopId: string;
  tourId: string;
}) {
  if (!tourId.trim()) {
    throw new Error("Missing tour id.");
  }

  if (!stopId.trim()) {
    throw new Error("Missing stop id.");
  }

  if (!file.name.trim()) {
    throw new Error("Audio file must have a file name.");
  }

  if (file.size <= 0) {
    throw new Error("Audio file is empty.");
  }

  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    throw new Error("Audio file must be 50 MB or smaller.");
  }

  if (!ALLOWED_AUDIO_MIME_TYPES.has(file.type)) {
    throw new Error(
      "Audio file must be AAC, MP3, M4A, OGG, WAV, or WebM audio."
    );
  }
}

function createAudioStoragePath({
  fileName,
  stopId,
  tourId
}: {
  fileName: string;
  stopId: string;
  tourId: string;
}): string {
  const creatorId = process.env.STUDIO_DEMO_CREATOR_ID ?? DEFAULT_CREATOR_ID;
  const uniquePrefix = `${Date.now()}-${randomUUID()}`;

  return [
    sanitizePathSegment(creatorId),
    sanitizePathSegment(tourId),
    sanitizePathSegment(stopId),
    `${uniquePrefix}-${fileName}`
  ].join("/");
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[/\\]/g, "-")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 180);

  return sanitized || "stop-audio";
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);

  return sanitized || "asset";
}

function createFallbackTourCode(title: string, id: string): string {
  const code = title
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);

  return `${code || "TOUR"}-${id.slice(0, 4).toUpperCase()}`.slice(0, 16);
}

const DEMO_AUDIO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3";
