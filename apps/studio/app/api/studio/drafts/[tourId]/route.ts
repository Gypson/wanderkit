import { loadStudioDraft } from "@/lib/studioDraftServer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tourId: string }> }
) {
  try {
    const { tourId } = await params;
    const result = await loadStudioDraft(tourId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Draft could not be loaded.",
        status: "error"
      },
      { status: 400 }
    );
  }
}

