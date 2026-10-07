import { NextRequest, NextResponse } from "next/server";
import { apiError, loadLedger, requireReviewAuth } from "@/lib/server";

export async function GET(request: NextRequest, context: { params: Promise<{ actionId: string }> }) {
  try {
    requireReviewAuth(request);
    const namespace = request.nextUrl.searchParams.get("namespace");
    if (!namespace) throw new Error("namespace query parameter is required");
    const { actionId } = await context.params;
    const action = (await loadLedger(namespace)).actions.find((item) => item.id === actionId);
    if (!action) throw new Error(`Action ${actionId} not found`);
    return NextResponse.json(action);
  } catch (error) { return apiError(error); }
}
