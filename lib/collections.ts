import { createHash } from "node:crypto";
import type { FinancialEvent, InvoicePlan, Ledger, Plan, ReminderAction } from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateValue = (value: string) => {
  if (!datePattern.test(value)) throw new Error(`Invalid ISO date: ${value}`);
  const parsed = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) throw new Error(`Invalid ISO date: ${value}`);
  return parsed;
};
const daysBetween = (from: string, to: string) => Math.floor((dateValue(to) - dateValue(from)) / 86_400_000);
const positiveInt = (value: unknown, label: string) => {
  if (!Number.isInteger(value) || (value as number) <= 0) throw new Error(`${label} must be a positive integer`);
};
const nonempty = (value: unknown, label: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonempty string`);
};
const unique = (values: string[], label: string) => {
  const repeated = values.find((value, index) => values.indexOf(value) !== index);
  if (repeated) throw new Error(`Duplicate ${label}: ${repeated}`);
};
const sameEvent = (a: FinancialEvent, b: FinancialEvent) => JSON.stringify(a) === JSON.stringify(b);

export function canonicalEvents(events: FinancialEvent[]) {
  const byRef = new Map<string, FinancialEvent>();
  for (const event of events) {
    const existing = byRef.get(event.ref);
    if (existing && !sameEvent(existing, event)) throw new Error(`Event ref ${event.ref} was repeated with different fields`);
    if (!existing) byRef.set(event.ref, event);
  }
  const distinct = [...byRef.values()];
  unique(distinct.map((event) => String(event.seq)), "event seq");
  return distinct.sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq);
}

export function validateLedger(ledger: Ledger) {
  nonempty(ledger.namespace, "namespace");
  if (!Array.isArray(ledger.customers) || !Array.isArray(ledger.invoices) || !Array.isArray(ledger.events) || !Array.isArray(ledger.cases) || !Array.isArray(ledger.actions)) throw new Error("customers, invoices, events, cases and actions must be arrays");
  unique(ledger.customers.map((x) => x.id), "customer id");
  unique(ledger.invoices.map((x) => x.id), "invoice id");
  unique(ledger.cases.map((x) => x.id), "case id");
  unique(ledger.actions.map((x) => x.id), "action id");
  const customers = new Map(ledger.customers.map((x) => [x.id, x]));
  const invoices = new Map(ledger.invoices.map((x) => [x.id, x]));
  for (const customer of ledger.customers) {
    nonempty(customer.id, "customer.id"); nonempty(customer.name, "customer.name"); nonempty(customer.recipient_alias, "customer.recipient_alias");
  }
  for (const invoice of ledger.invoices) {
    nonempty(invoice.id, "invoice.id");
    if (!customers.has(invoice.customer_id)) throw new Error(`Invoice ${invoice.id} references unknown customer ${invoice.customer_id}`);
    positiveInt(invoice.amount_cents, `${invoice.id}.amount_cents`);
    if (dateValue(invoice.issued) > dateValue(invoice.due)) throw new Error(`Invoice ${invoice.id} is issued after its due date`);
  }
  const events = canonicalEvents(ledger.events);
  for (const event of events) {
    nonempty(event.ref, "event.ref");
    if (!Number.isInteger(event.seq) || event.seq < 0) throw new Error(`${event.ref}.seq must be a nonnegative integer`);
    positiveInt(event.amount_cents, `${event.ref}.amount_cents`);
    dateValue(event.date);
    if (!(["payment", "credit", "refund"] as string[]).includes(event.type)) throw new Error(`Unsupported event type on ${event.ref}`);
    if ((event.type === "credit" || event.type === "refund") && !event.invoice_id) throw new Error(`${event.type} ${event.ref} requires an invoice`);
    if (!event.invoice_id && event.type === "payment" && !event.customer_id) continue;
    if (event.invoice_id) {
      const invoice = invoices.get(event.invoice_id);
      if (!invoice) throw new Error(`Event ${event.ref} references unknown invoice ${event.invoice_id}`);
      if (event.customer_id !== invoice.customer_id) throw new Error(`Event ${event.ref} customer does not match invoice ${invoice.id}`);
      if (dateValue(event.date) < dateValue(invoice.issued)) throw new Error(`Event ${event.ref} predates invoice ${invoice.id}`);
    } else if (event.customer_id && !customers.has(event.customer_id)) throw new Error(`Event ${event.ref} references unknown customer ${event.customer_id}`);
  }
  for (const item of ledger.cases) {
    const invoice = invoices.get(item.invoice_id);
    if (!invoice) throw new Error(`Case ${item.id} references unknown invoice ${item.invoice_id}`);
    positiveInt(item.type === "promise" ? 1 : item.amount_cents, `${item.id}.amount_cents`);
    if (item.type === "promise" && (item.amount_cents !== 0 || !item.promised_date)) throw new Error(`Promise ${item.id} requires zero amount and a promised_date`);
    if (item.type === "dispute" && item.promised_date !== null) throw new Error(`Dispute ${item.id} cannot have a promised_date`);
    if (item.closed && dateValue(item.closed) < dateValue(item.opened)) throw new Error(`Case ${item.id} closes before it opens`);
    if (item.promised_date && dateValue(item.promised_date) < dateValue(item.opened)) throw new Error(`Promise ${item.id} date precedes opening`);
  }
  const promises = ledger.cases.filter((x) => x.type === "promise" && x.closed === null);
  for (const invoice of ledger.invoices) if (promises.filter((x) => x.invoice_id === invoice.id).length > 1) throw new Error(`Invoice ${invoice.id} has more than one active promise`);
  for (const action of ledger.actions) if (!invoices.has(action.invoice_id)) throw new Error(`Action ${action.id} references unknown invoice ${action.invoice_id}`);
  return events;
}

export function calculatePlan(ledger: Ledger, asOf: string): Plan {
  dateValue(asOf);
  const events = validateLedger(ledger);
  const effectiveEvents = events.filter((event) => event.date <= asOf);
  const customersWithUnallocated = new Set(effectiveEvents.filter((event) => event.type === "payment" && !event.invoice_id && event.customer_id).map((event) => event.customer_id));
  let cashReceived = 0;
  let cashRefunded = 0;
  let unallocated = 0;
  for (const event of effectiveEvents) {
    if (event.type === "payment") {
      cashReceived += event.amount_cents;
      if (!event.invoice_id) unallocated += event.amount_cents;
    } else if (event.type === "refund") cashRefunded += event.amount_cents;
  }
  const invoicePlans: InvoicePlan[] = [];
  for (const invoice of ledger.invoices.filter((item) => item.issued <= asOf)) {
    let signed = invoice.amount_cents;
    let creditAvailable = 0;
    for (const event of effectiveEvents.filter((item) => item.invoice_id === invoice.id)) {
      if (event.type === "payment") { signed -= event.amount_cents; creditAvailable = Math.max(0, -signed); }
      if (event.type === "credit") { signed -= event.amount_cents; creditAvailable = Math.max(0, -signed); }
      if (event.type === "refund") {
        if (event.amount_cents > creditAvailable) throw new Error(`Refund ${event.ref} exceeds existing credit on invoice ${invoice.id}`);
        signed += event.amount_cents;
        creditAvailable -= event.amount_cents;
      }
    }
    const outstanding = Math.max(0, signed);
    const customerCredit = Math.max(0, -signed);
    const overdueDays = Math.max(0, daysBetween(invoice.due, asOf));
    const ageBand: InvoicePlan["age_band"] = overdueDays === 0 ? "current" : overdueDays <= 7 ? "1_7" : overdueDays <= 30 ? "8_30" : "31_plus";
    const activeCases = ledger.cases.filter((item) => item.invoice_id === invoice.id && item.opened <= asOf && (!item.closed || item.closed > asOf));
    const disputed = Math.min(outstanding, activeCases.filter((x) => x.type === "dispute").reduce((sum, x) => sum + x.amount_cents, 0));
    const promise = activeCases.some((x) => x.type === "promise" && !!x.promised_date && x.promised_date >= asOf);
    const reasons: string[] = [];
    if (!outstanding) reasons.push("no_debt");
    if (!overdueDays && outstanding) reasons.push("not_overdue");
    if (disputed) reasons.push("disputed_part");
    if (promise) reasons.push("promise");
    if (customersWithUnallocated.has(invoice.customer_id)) reasons.push("unallocated_payment");
    const blockingAction = ledger.actions.find((action) => action.invoice_id === invoice.id && ["provider_accepted", "stopped"].includes(action.state));
    if (blockingAction) reasons.push("delivery_unconfirmed");
    const recent = ledger.actions.some((action) => action.invoice_id === invoice.id && action.state === "received" && !!action.received_at && daysBetween(action.received_at.slice(0, 10), asOf) < 7 && daysBetween(action.received_at.slice(0, 10), asOf) >= 0);
    if (recent) reasons.push("recent_reminder");
    const held = !outstanding || !overdueDays || promise || customersWithUnallocated.has(invoice.customer_id) || !!blockingAction || recent;
    const eligible = held ? 0 : Math.max(0, outstanding - disputed);
    invoicePlans.push({ id: invoice.id, outstanding_cents: outstanding, customer_credit_cents: customerCredit, overdue_days: overdueDays, age_band: ageBand, disputed_cents: disputed, eligible_cents: eligible, reasons });
  }
  const totals: Plan["totals"] = {
    outstanding_cents: 0, customer_credit_cents: 0, overdue_cents: 0, disputed_cents: 0,
    unallocated_cents: unallocated, cash_received_cents: cashReceived, cash_refunded_cents: cashRefunded,
    net_cash_cents: cashReceived - cashRefunded, eligible_cents: 0,
    ageing_cents: { current: 0, "1_7": 0, "8_30": 0, "31_plus": 0 },
  };
  for (const invoice of invoicePlans) {
    totals.outstanding_cents += invoice.outstanding_cents;
    totals.customer_credit_cents += invoice.customer_credit_cents;
    if (invoice.overdue_days > 0) totals.overdue_cents += invoice.outstanding_cents;
    totals.disputed_cents += invoice.disputed_cents;
    totals.eligible_cents += invoice.eligible_cents;
    totals.ageing_cents[invoice.age_band] += invoice.outstanding_cents;
  }
  invoicePlans.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return { namespace: ledger.namespace, as_of: asOf, invoices: invoicePlans, totals };
}

export function stableActionId(namespace: string, invoiceId: string, asOf: string, amountCents: number, alias: string) {
  const hash = createHash("sha256").update([namespace, invoiceId, asOf, amountCents, alias].join("|")).digest("hex").slice(0, 16);
  return `RA-${hash}`;
}

export function makePreparedAction(ledger: Ledger, invoiceId: string, asOf: string, fixedAlias: string): ReminderAction {
  const invoice = ledger.invoices.find((item) => item.id === invoiceId);
  if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);
  const customer = ledger.customers.find((item) => item.id === invoice.customer_id)!;
  if (customer.recipient_alias !== fixedAlias) throw new Error(`Recipient alias must be ${fixedAlias}`);
  const item = calculatePlan(ledger, asOf).invoices.find((row) => row.id === invoiceId)!;
  if (!item.eligible_cents) throw new Error(`Invoice ${invoiceId} is not reminder-eligible: ${item.reasons.join(", ")}`);
  return {
    id: stableActionId(ledger.namespace, invoiceId, asOf, item.eligible_cents, fixedAlias), invoice_id: invoiceId,
    date: asOf, state: "prepared", namespace: ledger.namespace, approved_amount_cents: item.eligible_cents,
    approved_recipient_alias: fixedAlias, approved_as_of: asOf, customer_name: customer.name, due: invoice.due,
  };
}
