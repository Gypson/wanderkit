import {
  listStudioDrafts,
  parseStudioDraftPayload,
  saveStudioDraft
} from "@/lib/studioDraftServer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const result = await listStudioDrafts();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        drafts: [],
        message:
          error instanceof Error ? error.message : "Drafts could not be loaded.",
        status: "error"
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const draft = parseStudioDraftPayload(await request.json());
    const result = await saveStudioDraft(draft);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Draft could not be saved.",
        status: "error"
      },
      { status: 400 }
    );
  }
}
