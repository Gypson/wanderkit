import * as FileSystem from "expo-file-system";

export type CachedAudioResult =
  | {
      source: "cache";
      uri: string;
    }
  | {
      source: "download";
      uri: string;
    }
  | {
      message: string;
      source: "remote";
      uri: string;
    };

export type AudioCacheSummary = {
  fileCount: number;
  sizeBytes: number;
};

export type AudioCacheStatus = "downloaded" | "not-downloaded" | "unavailable";

export type AudioCacheStatusByStopId = Record<string, AudioCacheStatus>;

export type AudioCacheDownloadResult = {
  message: string;
  status: AudioCacheStatus;
};

const AUDIO_CACHE_DIR = `${FileSystem.documentDirectory ?? ""}wanderkit-audio/`;

export async function getCachedAudioUri({
  audioUrl,
  stopId,
  tourCode
}: {
  audioUrl: string;
  stopId: string;
  tourCode: string;
}): Promise<CachedAudioResult> {
  if (!FileSystem.documentDirectory) {
    return {
      source: "remote",
      uri: audioUrl,
      message: "File storage is not available on this device."
    };
  }

  const localUri = createAudioFileUri({ audioUrl, stopId, tourCode });
  const cachedFile = await FileSystem.getInfoAsync(localUri);

  if (cachedFile.exists && !cachedFile.isDirectory) {
    return {
      source: "cache",
      uri: localUri
    };
  }

  try {
    await ensureAudioCacheDirectory();
    const download = await FileSystem.downloadAsync(audioUrl, localUri);

    if (download.status >= 200 && download.status < 300) {
      return {
        source: "download",
        uri: download.uri
      };
    }

    await deletePartialFile(localUri);

    return {
      source: "remote",
      uri: audioUrl,
      message: `Audio download returned HTTP ${download.status}.`
    };
  } catch (error) {
    await deletePartialFile(localUri);

    return {
      source: "remote",
      uri: audioUrl,
      message:
        error instanceof Error
          ? error.message
          : "Audio could not be downloaded."
    };
  }
}

export async function getAudioCacheSummary(): Promise<AudioCacheSummary> {
  if (!FileSystem.documentDirectory) {
    return {
      fileCount: 0,
      sizeBytes: 0
    };
  }

  const directory = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);

  if (!directory.exists || !directory.isDirectory) {
    return {
      fileCount: 0,
      sizeBytes: 0
    };
  }

  const fileNames = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIR);
  let sizeBytes = 0;
  let fileCount = 0;

  for (const fileName of fileNames) {
    const file = await FileSystem.getInfoAsync(`${AUDIO_CACHE_DIR}${fileName}`);

    if (file.exists && !file.isDirectory) {
      fileCount += 1;
      sizeBytes += file.size;
    }
  }

  return {
    fileCount,
    sizeBytes
  };
}

export async function getCachedAudioStatus({
  audioUrl,
  stopId,
  tourCode
}: {
  audioUrl: string;
  stopId: string;
  tourCode: string;
}): Promise<AudioCacheStatus> {
  if (!FileSystem.documentDirectory) {
    return "unavailable";
  }

  const localUri = createAudioFileUri({ audioUrl, stopId, tourCode });
  const cachedFile = await FileSystem.getInfoAsync(localUri);

  return cachedFile.exists && !cachedFile.isDirectory
    ? "downloaded"
    : "not-downloaded";
}

export async function getCachedAudioStatuses({
  stops,
  tourCode
}: {
  stops: Array<{ audioUrl: string; id: string }>;
  tourCode: string;
}): Promise<AudioCacheStatusByStopId> {
  const entries = await Promise.all(
    stops.map(async (stop) => {
      try {
        const status = await getCachedAudioStatus({
          audioUrl: stop.audioUrl,
          stopId: stop.id,
          tourCode
        });

        return [stop.id, status] as const;
      } catch {
        return [stop.id, "unavailable"] as const;
      }
    })
  );

  return Object.fromEntries(entries);
}

export async function downloadAudioForStop({
  audioUrl,
  stopId,
  tourCode
}: {
  audioUrl: string;
  stopId: string;
  tourCode: string;
}): Promise<AudioCacheDownloadResult> {
  const result = await getCachedAudioUri({ audioUrl, stopId, tourCode });

  if (result.source === "cache") {
    return {
      status: "downloaded",
      message: "Audio already saved."
    };
  }

  if (result.source === "download") {
    return {
      status: "downloaded",
      message: "Audio saved for offline replay."
    };
  }

  return {
    status: FileSystem.documentDirectory ? "not-downloaded" : "unavailable",
    message: result.message
  };
}

export async function clearAudioCache(): Promise<AudioCacheSummary> {
  const summary = await getAudioCacheSummary();

  if (!FileSystem.documentDirectory || summary.fileCount === 0) {
    return summary;
  }

  const directory = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);

  if (directory.exists && directory.isDirectory) {
    await FileSystem.deleteAsync(AUDIO_CACHE_DIR, { idempotent: true });
  }

  return summary;
}

export async function clearCachedAudioForStops({
  stops,
  tourCode
}: {
  stops: Array<{ audioUrl: string; id: string }>;
  tourCode: string;
}): Promise<AudioCacheSummary> {
  if (!FileSystem.documentDirectory || stops.length === 0) {
    return {
      fileCount: 0,
      sizeBytes: 0
    };
  }

  const directory = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);

  if (!directory.exists || !directory.isDirectory) {
    return {
      fileCount: 0,
      sizeBytes: 0
    };
  }

  let fileCount = 0;
  let sizeBytes = 0;

  for (const stop of stops) {
    const localUri = createAudioFileUri({
      audioUrl: stop.audioUrl,
      stopId: stop.id,
      tourCode
    });
    const file = await FileSystem.getInfoAsync(localUri);

    if (file.exists && !file.isDirectory) {
      fileCount += 1;
      sizeBytes += file.size;
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
  }

  return {
    fileCount,
    sizeBytes
  };
}

async function ensureAudioCacheDirectory(): Promise<void> {
  const directory = await FileSystem.getInfoAsync(AUDIO_CACHE_DIR);

  if (!directory.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIR, {
      intermediates: true
    });
  }
}

async function deletePartialFile(fileUri: string): Promise<void> {
  const file = await FileSystem.getInfoAsync(fileUri);

  if (file.exists && !file.isDirectory) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }
}

function createAudioFileUri({
  audioUrl,
  stopId,
  tourCode
}: {
  audioUrl: string;
  stopId: string;
  tourCode: string;
}): string {
  const extension = getAudioFileExtension(audioUrl);
  const fileName = [
    sanitizePathSegment(tourCode),
    sanitizePathSegment(stopId),
    hashString(audioUrl)
  ].join("-");

  return `${AUDIO_CACHE_DIR}${fileName}${extension}`;
}

function getAudioFileExtension(audioUrl: string): string {
  try {
    const path = new URL(audioUrl).pathname;
    const match = path.match(/\.[A-Za-z0-9]+$/);

    return match ? match[0].toLowerCase() : ".mp3";
  } catch {
    return ".mp3";
  }
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 80);

  return sanitized || "audio";
}

function hashString(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}
