import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PublishedStop, PublishedTourManifest } from "@wanderkit/shared";

const RESUME_STATE_KEY = "wanderkit:visitor-resume";

export type VisitorResumeStop = {
  id: string;
  number: number;
  title: string;
};

export type VisitorResumeState = {
  city: string;
  lastStop: VisitorResumeStop | null;
  tourCode: string;
  tourTitle: string;
  updatedAt: string;
};

export async function getVisitorResumeState(): Promise<VisitorResumeState | null> {
  const rawValue = await AsyncStorage.getItem(RESUME_STATE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = parseVisitorResumeState(rawValue);

    if (!parsed) {
      await AsyncStorage.removeItem(RESUME_STATE_KEY);
    }

    return parsed;
  } catch {
    await AsyncStorage.removeItem(RESUME_STATE_KEY);
    return null;
  }
}

export async function saveVisitorResumeTour(
  manifest: PublishedTourManifest
): Promise<void> {
  await saveVisitorResumeState({
    city: manifest.city,
    lastStop: null,
    tourCode: manifest.tourCode,
    tourTitle: manifest.title,
    updatedAt: new Date().toISOString()
  });
}

export async function saveVisitorResumeStop({
  manifest,
  stop
}: {
  manifest: PublishedTourManifest;
  stop: PublishedStop;
}): Promise<void> {
  await saveVisitorResumeState({
    city: manifest.city,
    lastStop: {
      id: stop.id,
      number: stop.number,
      title: stop.title
    },
    tourCode: manifest.tourCode,
    tourTitle: manifest.title,
    updatedAt: new Date().toISOString()
  });
}

export async function clearVisitorResumeState(): Promise<void> {
  await AsyncStorage.removeItem(RESUME_STATE_KEY);
}

async function saveVisitorResumeState(
  state: VisitorResumeState
): Promise<void> {
  await AsyncStorage.setItem(RESUME_STATE_KEY, JSON.stringify(state));
}

function parseVisitorResumeState(rawValue: string): VisitorResumeState | null {
  const parsed = JSON.parse(rawValue) as Partial<VisitorResumeState>;

  if (
    !isRecord(parsed) ||
    typeof parsed.city !== "string" ||
    typeof parsed.tourCode !== "string" ||
    typeof parsed.tourTitle !== "string" ||
    typeof parsed.updatedAt !== "string"
  ) {
    return null;
  }

  const lastStop = parseResumeStop(parsed.lastStop);

  if (lastStop === undefined) {
    return null;
  }

  return {
    city: parsed.city,
    lastStop,
    tourCode: parsed.tourCode,
    tourTitle: parsed.tourTitle,
    updatedAt: parsed.updatedAt
  };
}

function parseResumeStop(value: unknown): VisitorResumeStop | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.number !== "number" ||
    !Number.isFinite(value.number) ||
    typeof value.title !== "string"
  ) {
    return undefined;
  }

  return {
    id: value.id,
    number: value.number,
    title: value.title
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
