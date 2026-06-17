import {
  parseStudioDraftPayload,
  publishStudioDraft
} from "@/lib/studioDraftServer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const draft = parseStudioDraftPayload(await request.json());
    const result = await publishStudioDraft(draft);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Manifest could not be published.",
        status: "error"
      },
      { status: 400 }
    );
  }
}
