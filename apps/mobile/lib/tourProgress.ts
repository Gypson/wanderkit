import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRESS_KEY_PREFIX = "wanderkit:tour-progress:";

export type TourProgressState = {
  completedAt: string | null;
  playedStopIds: string[];
  tourCode: string;
  updatedAt: string | null;
};

export function createEmptyTourProgress(tourCode: string): TourProgressState {
  return {
    completedAt: null,
    playedStopIds: [],
    tourCode: normalizeTourCode(tourCode),
    updatedAt: null
  };
}

export async function getTourProgressState(
  tourCode: string
): Promise<TourProgressState> {
  const key = createProgressKey(tourCode);
  const rawValue = await AsyncStorage.getItem(key);

  if (!rawValue) {
    return createEmptyTourProgress(tourCode);
  }

  try {
    return parseTourProgressState(rawValue);
  } catch {
    await AsyncStorage.removeItem(key);
    return createEmptyTourProgress(tourCode);
  }
}

export async function listTourProgressStates(): Promise<TourProgressState[]> {
  const keys = await AsyncStorage.getAllKeys();
  const progressKeys = keys.filter((key) => key.startsWith(PROGRESS_KEY_PREFIX));
  const entries = await AsyncStorage.multiGet(progressKeys);
  const states: TourProgressState[] = [];
  const invalidKeys: string[] = [];

  for (const [key, value] of entries) {
    if (!value) {
      continue;
    }

    try {
      states.push(parseTourProgressState(value));
    } catch {
      invalidKeys.push(key);
    }
  }

  if (invalidKeys.length > 0) {
    await AsyncStorage.multiRemove(invalidKeys);
  }

  return states.sort((left, right) => left.tourCode.localeCompare(right.tourCode));
}

export async function markTourStopPlayed({
  stopId,
  stopIds,
  tourCode
}: {
  stopId: string;
  stopIds: string[];
  tourCode: string;
}): Promise<TourProgressState> {
  const normalizedCode = normalizeTourCode(tourCode);
  const existingState = await getTourProgressState(normalizedCode);
  const playedStopIds = Array.from(
    new Set([...existingState.playedStopIds, stopId])
  ).filter((id) => stopIds.includes(id));
  const playedStopIdSet = new Set(playedStopIds);
  const isComplete =
    stopIds.length > 0 && stopIds.every((id) => playedStopIdSet.has(id));
  const now = new Date().toISOString();
  const nextState: TourProgressState = {
    completedAt: isComplete ? existingState.completedAt ?? now : null,
    playedStopIds,
    tourCode: normalizedCode,
    updatedAt: now
  };

  await AsyncStorage.setItem(
    createProgressKey(normalizedCode),
    JSON.stringify(nextState)
  );

  return nextState;
}

export async function clearTourProgressStates(): Promise<number> {
  const keys = await AsyncStorage.getAllKeys();
  const progressKeys = keys.filter((key) => key.startsWith(PROGRESS_KEY_PREFIX));

  if (progressKeys.length > 0) {
    await AsyncStorage.multiRemove(progressKeys);
  }

  return progressKeys.length;
}

export function getProgressSummary({
  playedCount,
  stopCount
}: {
  playedCount: number;
  stopCount: number;
}): string {
  if (stopCount <= 0) {
    return "No stops";
  }

  return `${playedCount} of ${stopCount} stops played`;
}

export function isStopPlayed(
  progress: TourProgressState,
  stopId: string
): boolean {
  return progress.playedStopIds.includes(stopId);
}

function createProgressKey(tourCode: string): string {
  return `${PROGRESS_KEY_PREFIX}${normalizeTourCode(tourCode)}`;
}

function normalizeTourCode(tourCode: string): string {
  return tourCode.trim().toUpperCase();
}

function parseTourProgressState(rawValue: string): TourProgressState {
  const parsed = JSON.parse(rawValue) as Partial<TourProgressState>;

  if (
    !isRecord(parsed) ||
    typeof parsed.tourCode !== "string" ||
    !Array.isArray(parsed.playedStopIds)
  ) {
    throw new Error("Invalid tour progress state.");
  }

  const playedStopIds = parsed.playedStopIds.filter(
    (stopId): stopId is string => typeof stopId === "string"
  );

  return {
    completedAt:
      typeof parsed.completedAt === "string" ? parsed.completedAt : null,
    playedStopIds: Array.from(new Set(playedStopIds)),
    tourCode: normalizeTourCode(parsed.tourCode),
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
