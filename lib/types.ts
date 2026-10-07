export type Customer = { id: string; name: string; recipient_alias: string; note?: string };
export type Invoice = { id: string; customer_id: string; issued: string; due: string; amount_cents: number; note?: string };
export type FinancialEvent = {
  ref: string; seq: number; date: string; type: "payment" | "credit" | "refund";
  amount_cents: number; invoice_id: string | null; customer_id: string | null; note?: string;
};
export type LedgerCase = {
  id: string; invoice_id: string; type: "dispute" | "promise"; opened: string; closed: string | null;
  amount_cents: number; promised_date: string | null; note?: string;
};
export type ActionState = "prepared" | "authorised" | "provider_accepted" | "received" | "stopped" | "cancelled";
export type ReminderAction = {
  id: string; invoice_id: string; date: string; state: ActionState;
  namespace?: string; approved_amount_cents?: number; approved_recipient_alias?: string;
  approved_as_of?: string; delivery_reference?: string; received_at?: string;
  stop_reason?: string; session_id?: string; customer_name?: string; due?: string;
};
export type Ledger = {
  namespace: string; customers: Customer[]; invoices: Invoice[]; events: FinancialEvent[];
  cases: LedgerCase[]; actions: ReminderAction[];
};
export type InvoicePlan = {
  id: string; outstanding_cents: number; customer_credit_cents: number; overdue_days: number;
  age_band: "current" | "1_7" | "8_30" | "31_plus"; disputed_cents: number;
  eligible_cents: number; reasons: string[];
};
export type Plan = {
  namespace: string; as_of: string; invoices: InvoicePlan[];
  totals: {
    outstanding_cents: number; customer_credit_cents: number; overdue_cents: number;
    disputed_cents: number; unallocated_cents: number; cash_received_cents: number;
    cash_refunded_cents: number; net_cash_cents: number; eligible_cents: number;
    ageing_cents: { current: number; "1_7": number; "8_30": number; "31_plus": number };
  };
};
