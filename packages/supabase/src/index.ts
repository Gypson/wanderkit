import {
  ContentHashSchema,
  PublishedTourManifestSchema,
  type PublishedTourManifest
} from "@wanderkit/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

export type { Database, Json } from "./database.types";

export type WanderKitSupabaseClient = SupabaseClient<Database>;

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export type SupabaseServiceConfig = {
  url: string;
  serviceRoleKey: string;
};

export type SupabasePublicEnv = Partial<
  Record<
    | "NEXT_PUBLIC_SUPABASE_URL"
    | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    | "EXPO_PUBLIC_SUPABASE_URL"
    | "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    string | undefined
  >
>;

export function createWanderKitSupabaseClient({
  url,
  anonKey
}: SupabasePublicConfig): WanderKitSupabaseClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function createWanderKitSupabaseServiceClient({
  url,
  serviceRoleKey
}: SupabaseServiceConfig): WanderKitSupabaseClient {
  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export function getStudioSupabaseConfig(
  env: SupabasePublicEnv
): SupabasePublicConfig {
  return {
    url: requireEnv(env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv(
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
  };
}

export function getMobileSupabaseConfig(
  env: SupabasePublicEnv
): SupabasePublicConfig {
  return {
    url: requireEnv(env.EXPO_PUBLIC_SUPABASE_URL, "EXPO_PUBLIC_SUPABASE_URL"),
    anonKey: requireEnv(
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    )
  };
}

export function getOptionalMobileSupabaseConfig(
  env: SupabasePublicEnv
): SupabasePublicConfig | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function getOptionalSupabaseServiceConfig(env: {
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  SUPABASE_SERVICE_ROLE_KEY?: string | undefined;
}): SupabaseServiceConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

export class InvalidPublishedTourManifestError extends Error {
  readonly issues: string[];
  readonly tourCode: string;

  constructor(tourCode: string, issues: string[]) {
    super(`Published tour manifest for ${tourCode} failed validation.`);
    this.name = "InvalidPublishedTourManifestError";
    this.issues = issues;
    this.tourCode = tourCode;
  }
}

export async function fetchPublishedTourManifestByCode(
  client: WanderKitSupabaseClient,
  tourCode: string
): Promise<PublishedTourManifest | null> {
  const { data, error } = await client
    .from("published_tour_manifests")
    .select("manifest,content_hash")
    .eq("tour_code", tourCode)
    .order("publish_version", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const row =
    (data as { content_hash: string; manifest: unknown }[])[0] ?? null;
  if (!row) {
    return null;
  }

  const storedHash = ContentHashSchema.safeParse(row.content_hash);
  if (!storedHash.success) {
    throw new InvalidPublishedTourManifestError(tourCode, [
      "content_hash: Stored manifest hash is not a valid SHA-256 hash."
    ]);
  }

  const parsed = PublishedTourManifestSchema.safeParse(row.manifest);
  if (!parsed.success) {
    throw new InvalidPublishedTourManifestError(
      tourCode,
      parsed.error.issues.map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      })
    );
  }

  if (parsed.data.contentHash !== storedHash.data) {
    throw new InvalidPublishedTourManifestError(tourCode, [
      "contentHash: Manifest hash does not match the stored content_hash."
    ]);
  }

  return parsed.data;
}

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}
