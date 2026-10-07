import { NextRequest, NextResponse } from "next/server";
import { apiError, loadLedger, requireReviewAuth } from "@/lib/server";

export async function GET(request: NextRequest, context: { params: Promise<{ namespace: string }> }) {
  try {
    requireReviewAuth(request);
    const { namespace } = await context.params;
    return NextResponse.json(await loadLedger(namespace));
  } catch (error) { return apiError(error); }
}
