import { listStudioPublishHistory } from "@/lib/studioDraftServer";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tourId: string }> }
) {
  try {
    const { tourId } = await params;
    const result = await listStudioPublishHistory(tourId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        history: [],
        message:
          error instanceof Error
            ? error.message
            : "Publish history could not be loaded.",
        status: "error"
      },
      { status: 400 }
    );
  }
}
