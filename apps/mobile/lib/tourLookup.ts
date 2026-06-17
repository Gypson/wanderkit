import type { PublishedTourManifest } from "@wanderkit/shared";
import {
  fetchPublishedTourManifestByCode,
  InvalidPublishedTourManifestError
} from "@wanderkit/supabase";
import {
  cachePublishedTourManifest,
  getCachedPublishedTourManifest
} from "./manifestCache";
import { getMobileSupabaseClient } from "./supabase";

export type TourLookupState =
  | { status: "loading" }
  | { status: "config-missing" }
  | { status: "not-found"; code: string }
  | { status: "invalid"; code: string; issues: string[] }
  | { status: "error"; message: string }
  | {
      manifest: PublishedTourManifest;
      reason: "config-missing" | "network-error";
      status: "cached";
    }
  | { status: "success"; manifest: PublishedTourManifest };

export async function loadPublishedTourManifest(
  tourCode: string
): Promise<TourLookupState> {
  const normalizedCode = normalizeTourCode(tourCode);
  const client = getMobileSupabaseClient();

  if (!client) {
    const cachedManifest = await getCachedManifestSafely(normalizedCode);

    if (cachedManifest) {
      return {
        status: "cached",
        reason: "config-missing",
        manifest: cachedManifest
      };
    }

    return { status: "config-missing" };
  }

  try {
    const manifest = await fetchPublishedTourManifestByCode(
      client,
      normalizedCode
    );

    if (!manifest) {
      return { status: "not-found", code: normalizedCode };
    }

    await cacheManifestSafely(manifest);

    return { status: "success", manifest };
  } catch (error) {
    if (isInvalidManifestError(error)) {
      return {
        status: "invalid",
        code: normalizedCode,
        issues: error.issues
      };
    }

    const cachedManifest = await getCachedManifestSafely(normalizedCode);

    if (cachedManifest) {
      return {
        status: "cached",
        reason: "network-error",
        manifest: cachedManifest
      };
    }

    return {
      status: "error",
      message:
        error instanceof Error ? error.message : "The tour could not be loaded."
    };
  }
}

export function normalizeTourCode(value: string | string[] | undefined): string {
  const rawValue = Array.isArray(value) ? value[0] : value;
  return (rawValue ?? "").trim().toUpperCase();
}

async function getCachedManifestSafely(
  tourCode: string
): Promise<PublishedTourManifest | null> {
  try {
    return await getCachedPublishedTourManifest(tourCode);
  } catch {
    return null;
  }
}

async function cacheManifestSafely(
  manifest: PublishedTourManifest
): Promise<void> {
  try {
    await cachePublishedTourManifest(manifest);
  } catch {
    // Cache writes should never block a fresh, valid manifest.
  }
}

function isInvalidManifestError(
  error: unknown
): error is InvalidPublishedTourManifestError {
  return (
    error instanceof InvalidPublishedTourManifestError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "InvalidPublishedTourManifestError" &&
      "issues" in error &&
      Array.isArray(error.issues))
  );
}
