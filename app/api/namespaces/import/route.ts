import { NextRequest, NextResponse } from "next/server";
import { validateLedger } from "@/lib/collections";
import type { Ledger } from "@/lib/types";
import { apiError, namespaceExists, requireReviewAuth, saveLedger } from "@/lib/server";

export async function POST(request: NextRequest) {
  try {
    requireReviewAuth(request);
    const ledger = await request.json() as Ledger;
    const events = validateLedger(ledger);
    if (await namespaceExists(ledger.namespace)) throw new Error(`Namespace ${ledger.namespace} already exists; imports never clear or overwrite a session`);
    await saveLedger({ ...ledger, events });
    return NextResponse.json({ ok: true, namespace: ledger.namespace, counts: { customers: ledger.customers.length, invoices: ledger.invoices.length, events: events.length, cases: ledger.cases.length, actions: ledger.actions.length } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
