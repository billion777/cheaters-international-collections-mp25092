import { NextRequest, NextResponse } from "next/server";
import { calculatePlan } from "@/lib/collections";
import { apiError, countSessionDispatches, fixedAlias, loadLedger, requireReviewAuth, reviewSessionId, saveAction } from "@/lib/server";

export async function POST(request: NextRequest) {
  let namespace = "";
  let actionId = "";
  try {
    requireReviewAuth(request);
    ({ namespace, action_id: actionId } = await request.json());
    let ledger = await loadLedger(namespace);
    let action = ledger.actions.find((item) => item.id === actionId);
    if (!action) throw new Error(`Action ${actionId} not found`);
    if (["provider_accepted", "received", "stopped", "cancelled"].includes(action.state)) return NextResponse.json({ ok: true, dispatched: false, duplicate_suppressed: true, action });
    if (action.state !== "authorised") throw new Error(`Action ${actionId} is not authorised`);
    const invoice = ledger.invoices.find((item) => item.id === action!.invoice_id)!;
    const customer = ledger.customers.find((item) => item.id === invoice.customer_id)!;
    const planItem = calculatePlan(ledger, action.approved_as_of!).invoices.find((item) => item.id === invoice.id)!;
    const factsChanged = planItem.eligible_cents !== action.approved_amount_cents || customer.recipient_alias !== action.approved_recipient_alias || customer.recipient_alias !== fixedAlias();
    if (factsChanged) {
      action = { ...action, state: "cancelled", stop_reason: "Current ledger or recipient no longer matches the authorised snapshot" };
      await saveAction(namespace, action);
      return NextResponse.json({ ok: true, dispatched: false, stale_proposal_cancelled: true, action, current_plan: planItem });
    }
    if (await countSessionDispatches(reviewSessionId()) >= 3) {
      action = { ...action, state: "stopped", stop_reason: "Three-message review-session limit reached" };
      await saveAction(namespace, action);
      return NextResponse.json({ ok: true, dispatched: false, action });
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const amountEur = (action.approved_amount_cents! / 100).toFixed(2);
      const subject = `[FICTIONAL TEST] Payment reminder ${action.id} | ${invoice.id} | EUR ${amountEur} | due ${invoice.due}`;
      const emailBody = [
        "This is a fictional coursework test reminder. No real payment is requested.",
        `Customer: ${customer.name}`,
        `Action ID: ${action.id}`,
        `Invoice ID: ${invoice.id}`,
        `Amount due: EUR ${amountEur}`,
        `Original due date: ${invoice.due}`,
      ].join("\n");
      const response = await fetch(process.env.MAKE_WEBHOOK_URL!, {
        method: "POST", signal: controller.signal,
        headers: { "content-type": "application/json", "x-make-secret": process.env.MAKE_WEBHOOK_SECRET || "" },
        body: JSON.stringify({
          action_id: action.id, namespace, invoice_id: invoice.id, amount_cents: action.approved_amount_cents,
          amount_eur: amountEur, due_date: invoice.due, subject, text: emailBody,
          recipient_alias: fixedAlias(), customer_name: customer.name,
          callback_url: `${process.env.APP_BASE_URL}/api/actions/receipt`,
        }),
      });
      const text = await response.text();
      let result: Record<string, unknown> = {};
      try { result = text ? JSON.parse(text) : {}; } catch { result = {}; }
      if (!response.ok || result.accepted !== true || typeof result.delivery_reference !== "string") throw new Error(`Make did not return a valid acknowledgement (${response.status})`);
      action = {
        ...action,
        state: result.received === true ? "received" : "provider_accepted",
        delivery_reference: result.delivery_reference,
        received_at: result.received === true ? String(result.received_at || new Date().toISOString()) : undefined,
      };
      await saveAction(namespace, action);
      return NextResponse.json({ ok: true, dispatched: true, action });
    } catch (error) {
      action = { ...action, state: "stopped", stop_reason: `Delivery failed or outcome unknown: ${error instanceof Error ? error.message : "unknown error"}` };
      await saveAction(namespace, action);
      return NextResponse.json({ ok: false, dispatched: false, action }, { status: 502 });
    } finally { clearTimeout(timeout); }
  } catch (error) { return apiError(error); }
}
