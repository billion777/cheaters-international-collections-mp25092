import { NextRequest, NextResponse } from "next/server";
import { canonicalEvents, validateLedger } from "@/lib/collections";
import type { FinancialEvent } from "@/lib/types";
import { apiError, loadLedger, requireReviewAuth, saveLedger } from "@/lib/server";

export async function POST(request: NextRequest) {
  try {
    requireReviewAuth(request);
    const { namespace, event } = await request.json() as { namespace: string; event: FinancialEvent };
    const ledger = await loadLedger(namespace);
    const existing = ledger.events.find((item) => item.ref === event.ref);
    if (existing) {
      canonicalEvents([existing, event]);
      return NextResponse.json({ ok: true, ignored_identical_duplicate: true, event: existing });
    }
    const updated = { ...ledger, events: [...ledger.events, event] };
    validateLedger(updated);
    await saveLedger(updated);
    return NextResponse.json({ ok: true, ignored_identical_duplicate: false, event }, { status: 201 });
  } catch (error) { return apiError(error); }
}
