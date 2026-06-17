import { uploadStudioStopAudio } from "@/lib/studioDraftServer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const tourId = getFormString(formData, "tourId");
    const stopId = getFormString(formData, "stopId");
    const file = formData.get("file");

    if (!isFileUpload(file)) {
      throw new Error("Choose an audio file to upload.");
    }

    const result = await uploadStudioStopAudio({
      file,
      stopId,
      tourId
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Audio could not be uploaded.",
        status: "error"
      },
      { status: 400 }
    );
  }
}

function getFormString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function isFileUpload(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}
