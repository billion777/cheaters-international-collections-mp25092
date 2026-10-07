import { NextRequest, NextResponse } from "next/server";
import { apiError, loadLedger, requireReviewAuth, saveAction } from "@/lib/server";

export async function POST(request: NextRequest) {
  try {
    requireReviewAuth(request);
    const { namespace, action_id, invoice_id, amount_cents, due_date, delivery_reference, received_at } = await request.json();
    const ledger = await loadLedger(namespace);
    const action = ledger.actions.find((item) => item.id === action_id);
    if (!action) throw new Error(`Action ${action_id} not found`);
    if (action.state === "received") return NextResponse.json({ ok: true, duplicate_suppressed: true, action });
    if (action.state !== "provider_accepted") throw new Error(`Receipt cannot be confirmed while action is ${action.state}`);
    const invoice = ledger.invoices.find((item) => item.id === action.invoice_id)!;
    if (invoice_id !== action.invoice_id || amount_cents !== action.approved_amount_cents || due_date !== invoice.due || delivery_reference !== action.delivery_reference) {
      throw new Error("Inbox receipt evidence does not match the action snapshot");
    }
    const received = { ...action, state: "received" as const, received_at: received_at || new Date().toISOString() };
    await saveAction(namespace, received);
    return NextResponse.json({ ok: true, evidence: "manually_verified_test_inbox", action: received });
  } catch (error) { return apiError(error); }
}
