import { NextRequest, NextResponse } from "next/server";
import { calculatePlan } from "@/lib/collections";
import { apiError, loadLedger, requireReviewAuth } from "@/lib/server";

export async function POST(request: NextRequest) {
  try {
    requireReviewAuth(request);
    const { namespace, as_of } = await request.json();
    return NextResponse.json(calculatePlan(await loadLedger(namespace), as_of));
  } catch (error) { return apiError(error); }
}
