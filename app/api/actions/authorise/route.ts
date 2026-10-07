import { NextRequest, NextResponse } from "next/server";
import { apiError, fixedAlias, loadLedger, requireReviewAuth, saveAction } from "@/lib/server";

export async function POST(request: NextRequest) {
  try {
    requireReviewAuth(request);
    const { namespace, action_id, invoice_id, amount_cents, recipient_alias, as_of } = await request.json();
    const ledger = await loadLedger(namespace);
    const action = ledger.actions.find((item) => item.id === action_id);
    if (!action) throw new Error(`Action ${action_id} not found`);
    if (action.state === "authorised") return NextResponse.json({ ok: true, reused: true, action });
    if (action.state !== "prepared") throw new Error(`Action ${action_id} cannot be authorised from state ${action.state}`);
    if (invoice_id !== action.invoice_id || amount_cents !== action.approved_amount_cents || recipient_alias !== action.approved_recipient_alias || as_of !== action.approved_as_of) throw new Error("Authorisation must name the exact action, invoice, amount, recipient alias and as-of snapshot");
    if (recipient_alias !== fixedAlias()) throw new Error(`Recipient alias must be ${fixedAlias()}`);
    const authorised = { ...action, state: "authorised" as const };
    await saveAction(namespace, authorised);
    return NextResponse.json({ ok: true, reused: false, action: authorised });
  } catch (error) { return apiError(error); }
}
