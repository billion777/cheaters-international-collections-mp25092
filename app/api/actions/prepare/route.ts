import { NextRequest, NextResponse } from "next/server";
import { makePreparedAction } from "@/lib/collections";
import { apiError, fixedAlias, loadLedger, requireReviewAuth, reviewSessionId, saveAction } from "@/lib/server";

export async function POST(request: NextRequest) {
  try {
    requireReviewAuth(request);
    const { namespace, invoice_id, as_of } = await request.json();
    const ledger = await loadLedger(namespace);
    const existing = ledger.actions.find((action) => action.id === makePreparedAction(ledger, invoice_id, as_of, fixedAlias()).id);
    if (existing) return NextResponse.json({ ok: true, reused: true, action: existing });
    const action = { ...makePreparedAction(ledger, invoice_id, as_of, fixedAlias()), session_id: reviewSessionId() };
    await saveAction(namespace, action);
    return NextResponse.json({ ok: true, reused: false, action }, { status: 201 });
  } catch (error) { return apiError(error); }
}
