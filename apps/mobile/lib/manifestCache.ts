import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  PublishedTourManifestSchema,
  type PublishedTourManifest
} from "@wanderkit/shared";

const CACHE_KEY_PREFIX = "wanderkit:published-tour:";

export type CachedManifestSummary = {
  cachedAt: string | null;
  city: string;
  contentHash: string;
  publishedAt: string;
  stopCount: number;
  title: string;
  tourCode: string;
};

export type CachedPublishedTourManifest = {
  cachedAt: string | null;
  manifest: PublishedTourManifest;
};

export async function cachePublishedTourManifest(
  manifest: PublishedTourManifest
): Promise<void> {
  await AsyncStorage.setItem(
    createManifestCacheKey(manifest.tourCode),
    JSON.stringify({
      cachedAt: new Date().toISOString(),
      manifest
    })
  );
}

export async function getCachedPublishedTourManifest(
  tourCode: string
): Promise<PublishedTourManifest | null> {
  const cachedEntry = await getCachedPublishedTourManifestEntry(tourCode);
  return cachedEntry?.manifest ?? null;
}

export async function getCachedPublishedTourManifestEntry(
  tourCode: string
): Promise<CachedPublishedTourManifest | null> {
  const rawValue = await AsyncStorage.getItem(createManifestCacheKey(tourCode));

  if (!rawValue) {
    return null;
  }

  try {
    return parseCachedManifest(rawValue);
  } catch {
    await AsyncStorage.removeItem(createManifestCacheKey(tourCode));
    return null;
  }
}

export async function listCachedPublishedTourManifests(): Promise<
  CachedManifestSummary[]
> {
  const keys = await AsyncStorage.getAllKeys();
  const manifestKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));
  const entries = await AsyncStorage.multiGet(manifestKeys);
  const summaries: CachedManifestSummary[] = [];
  const invalidKeys: string[] = [];

  for (const [key, value] of entries) {
    if (!value) {
      continue;
    }

    try {
      const { cachedAt, manifest } = parseCachedManifest(value);
      summaries.push({
        cachedAt,
        city: manifest.city,
        contentHash: manifest.contentHash,
        publishedAt: manifest.publishedAt,
        stopCount: manifest.stops.length,
        title: manifest.title,
        tourCode: manifest.tourCode
      });
    } catch {
      invalidKeys.push(key);
    }
  }

  if (invalidKeys.length > 0) {
    await AsyncStorage.multiRemove(invalidKeys);
  }

  return summaries.sort((left, right) =>
    left.tourCode.localeCompare(right.tourCode)
  );
}

export async function clearCachedPublishedTourManifests(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const manifestKeys = keys.filter((key) => key.startsWith(CACHE_KEY_PREFIX));

  if (manifestKeys.length > 0) {
    await AsyncStorage.multiRemove(manifestKeys);
  }

  return manifestKeys.length;
}

function createManifestCacheKey(tourCode: string): string {
  return `${CACHE_KEY_PREFIX}${tourCode.trim().toUpperCase()}`;
}

function parseCachedManifest(rawValue: string): CachedPublishedTourManifest {
  const parsed = JSON.parse(rawValue) as {
    cachedAt?: unknown;
    manifest?: unknown;
  };
  const manifest = PublishedTourManifestSchema.parse(parsed.manifest);

  return {
    cachedAt: typeof parsed.cachedAt === "string" ? parsed.cachedAt : null,
    manifest
  };
}
