import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const HASH_PATTERN = /^sha256-[0-9a-f]{64}$/;
const REQUEST_TIMEOUT_MS = 10000;

const fileEnv = loadEnvFiles([".env", ".env.local"]);
const statusEnv = loadSupabaseStatusEnv();
const env = {
  ...statusEnv,
  ...fileEnv,
  ...process.env
};

const supabaseUrl =
  env.NEXT_PUBLIC_SUPABASE_URL ??
  env.EXPO_PUBLIC_SUPABASE_URL ??
  env.API_URL ??
  "http://127.0.0.1:54321";
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  env.ANON_KEY;
const serviceRoleKey =
  env.SUPABASE_SERVICE_ROLE_KEY ?? env.SERVICE_ROLE_KEY;

if (!anonKey || !serviceRoleKey) {
  fail(
    "Missing local Supabase keys. Run `pnpm supabase:start`, then `pnpm supabase:smoke` again."
  );
}

console.log(`Checking WanderKit local Supabase at ${supabaseUrl}`);

const oldTown = await fetchLatestManifest("OLDTOWN", anonKey);
assert(oldTown.tour_code === "OLDTOWN", "OLDTOWN row should use OLDTOWN code.");
assert(
  HASH_PATTERN.test(oldTown.content_hash),
  "OLDTOWN content_hash should be a SHA-256 manifest hash."
);
assert(
  oldTown.manifest?.contentHash === oldTown.content_hash,
  "OLDTOWN manifest contentHash should match content_hash."
);
assert(
  Array.isArray(oldTown.manifest?.stops) && oldTown.manifest.stops.length >= 2,
  "OLDTOWN should include playable stops."
);

const badJson = await fetchLatestManifest("BADJSON", anonKey);
assert(badJson.tour_code === "BADJSON", "BADJSON row should use BADJSON code.");
assert(
  badJson.manifest?.tourCode === "BADJSON" && !Array.isArray(badJson.manifest?.stops),
  "BADJSON should remain intentionally invalid for app-schema validation."
);

await assertManifestRowsAreImmutable(oldTown.id, serviceRoleKey);

console.log("Local Supabase smoke test passed.");

async function fetchLatestManifest(tourCode, key) {
  const url = new URL("/rest/v1/published_tour_manifests", supabaseUrl);
  url.searchParams.set("tour_code", `eq.${tourCode}`);
  url.searchParams.set(
    "select",
    "id,publish_version,tour_code,content_hash,manifest"
  );
  url.searchParams.set("order", "publish_version.desc");
  url.searchParams.set("limit", "1");

  const rows = await requestJson(url, key);
  assert(Array.isArray(rows), `${tourCode} lookup should return rows.`);
  assert(rows.length === 1, `${tourCode} should have one latest manifest row.`);

  return rows[0];
}

async function assertManifestRowsAreImmutable(id, key) {
  const url = new URL("/rest/v1/published_tour_manifests", supabaseUrl);
  url.searchParams.set("id", `eq.${id}`);

  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      "content-type": "application/json"
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    body: JSON.stringify({
      content_hash:
        "sha256-1111111111111111111111111111111111111111111111111111111111111111"
    })
  });

  if (response.ok) {
    fail("Published manifest rows should reject mutation attempts.");
  }
}

async function requestJson(url, key) {
  const response = await fetch(url, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    const body = await response.text();
    fail(`${url.pathname} failed with ${response.status}: ${body}`);
  }

  return response.json();
}

function loadEnvFiles(paths) {
  return paths.reduce((values, path) => {
    const absolutePath = resolve(path);
    if (!existsSync(absolutePath)) {
      return values;
    }

    for (const line of readFileSync(absolutePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      values[key] = value;
    }

    return values;
  }, {});
}

function loadSupabaseStatusEnv() {
  try {
    const output = execSync("supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000
    });

    return output.split(/\r?\n/).reduce((values, line) => {
      const separator = line.indexOf("=");
      if (separator === -1) {
        return values;
      }

      values[line.slice(0, separator)] = stripQuotes(line.slice(separator + 1));
      return values;
    }, {});
  } catch {
    return {};
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function stripQuotes(value) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
