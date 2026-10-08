import { NextResponse } from "next/server";
import { calculatePlan } from "@/lib/collections";
import { REVIEW_PLAN_AS_OF, REVIEW_PLAN_NAMESPACE } from "@/lib/review";
import { apiError, loadLedger } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const plan = calculatePlan(await loadLedger(REVIEW_PLAN_NAMESPACE), REVIEW_PLAN_AS_OF);
    return NextResponse.json({
      ...plan,
      review_scope: "Public read-only access to the fixed fictional practice namespace; no writes or dispatch are available.",
    });
  } catch (error) { return apiError(error); }
}

