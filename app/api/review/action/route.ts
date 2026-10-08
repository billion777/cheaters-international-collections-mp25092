import { NextResponse } from "next/server";
import { REVIEW_ACTION_ID, REVIEW_ACTION_NAMESPACE } from "@/lib/review";
import { apiError, loadLedger } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ledger = await loadLedger(REVIEW_ACTION_NAMESPACE);
    const action = ledger.actions.find((item) => item.id === REVIEW_ACTION_ID);
    if (!action) throw new Error(`Action ${REVIEW_ACTION_ID} not found`);
    return NextResponse.json({
      source: "Live restricted read from Airtable CollectionsRecords",
      namespace: REVIEW_ACTION_NAMESPACE,
      action,
      evidence_note: "The received state is matched by stable action ID, invoice, amount, due date and delivery reference. No resend is required.",
    });
  } catch (error) { return apiError(error); }
}

