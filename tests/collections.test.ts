import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calculatePlan, canonicalEvents, makePreparedAction } from "../lib/collections.ts";
import type { Ledger } from "../lib/types.ts";

const practice = JSON.parse(readFileSync(new URL("../public/practice.json", import.meta.url), "utf8")) as Ledger;

test("practice case matches all published figures on 15 March", () => {
  const plan = calculatePlan(practice, "2027-03-15");
  assert.deepEqual(plan.invoices.map((x) => ({ id: x.id, debt: x.outstanding_cents, credit: x.customer_credit_cents, overdue: x.overdue_days, band: x.age_band, disputed: x.disputed_cents, eligible: x.eligible_cents, reasons: x.reasons })), [
    { id:"I1", debt:6000, credit:0, overdue:5, band:"1_7", disputed:3000, eligible:3000, reasons:["disputed_part"] },
    { id:"I2", debt:0, credit:0, overdue:10, band:"8_30", disputed:0, eligible:0, reasons:["no_debt"] },
    { id:"I3", debt:24900, credit:0, overdue:3, band:"1_7", disputed:0, eligible:0, reasons:["unallocated_payment"] },
    { id:"I4", debt:1990, credit:0, overdue:5, band:"1_7", disputed:0, eligible:0, reasons:["promise"] },
    { id:"I5", debt:9400, credit:0, overdue:0, band:"current", disputed:0, eligible:0, reasons:["not_overdue"] },
    { id:"I6", debt:0, credit:2000, overdue:10, band:"8_30", disputed:0, eligible:0, reasons:["no_debt"] },
  ]);
  assert.deepEqual(plan.totals, { outstanding_cents:42290, customer_credit_cents:2000, overdue_cents:32890, disputed_cents:3000, unallocated_cents:10000, cash_received_cents:28900, cash_refunded_cents:7900, net_cash_cents:21000, eligible_cents:3000, ageing_cents:{ current:9400, "1_7":32890, "8_30":0, "31_plus":0 } });
});

test("promise holds through 15 March and releases on 16 March; I5 becomes overdue", () => {
  const day15 = calculatePlan(practice, "2027-03-15");
  const day16 = calculatePlan(practice, "2027-03-16");
  assert.equal(day15.invoices.find((x) => x.id === "I4")!.eligible_cents, 0);
  assert.equal(day16.invoices.find((x) => x.id === "I4")!.eligible_cents, 1990);
  assert.equal(day15.invoices.find((x) => x.id === "I5")!.eligible_cents, 0);
  assert.equal(day16.invoices.find((x) => x.id === "I5")!.eligible_cents, 9400);
});

test("identical event is idempotent and conflicting ref is blocked", () => {
  assert.equal(canonicalEvents([practice.events[0], practice.events[0]]).length, 1);
  assert.throws(() => canonicalEvents([practice.events[0], { ...practice.events[0], amount_cents: 4001 }]), /different fields/);
});

test("new EUR60 payment makes authorised I1 snapshot stale", () => {
  const action = makePreparedAction(practice, "I1", "2027-03-15", "HOMEWORK_TEST_INBOX");
  assert.equal(action.approved_amount_cents, 3000);
  const paid: Ledger = { ...practice, events: [...practice.events, { ref:"P1-LATE", seq:8, date:"2027-03-15", type:"payment", amount_cents:6000, invoice_id:"I1", customer_id:"C1" }] };
  const current = calculatePlan(paid, "2027-03-15").invoices.find((x) => x.id === "I1")!;
  assert.equal(current.outstanding_cents, 0);
  assert.equal(current.eligible_cents, 0);
});

test("seven full calendar days are required after confirmed receipt", () => {
  const withReceipt: Ledger = { ...practice, actions: [{ id:"R1", invoice_id:"I1", date:"2027-03-14", state:"received", received_at:"2027-03-14T09:00:00Z" }] };
  assert.ok(calculatePlan(withReceipt, "2027-03-20").invoices.find((x) => x.id === "I1")!.reasons.includes("recent_reminder"));
  assert.ok(!calculatePlan(withReceipt, "2027-03-21").invoices.find((x) => x.id === "I1")!.reasons.includes("recent_reminder"));
});
