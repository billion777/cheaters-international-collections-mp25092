import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Ledger, ReminderAction } from "./types";

type Kind = "customer" | "invoice" | "event" | "case" | "action";
type Stored = { airtableId: string; namespace: string; kind: Kind; recordId: string; payload: unknown };

const requiredEnv = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Server is not configured: missing ${name}`);
  return value;
};
const tableUrl = () => `https://api.airtable.com/v0/${requiredEnv("AIRTABLE_BASE_ID")}/${encodeURIComponent(process.env.AIRTABLE_TABLE_NAME || "CollectionsRecords")}`;
const headers = () => ({ Authorization: `Bearer ${requiredEnv("AIRTABLE_TOKEN")}`, "Content-Type": "application/json" });
const formulaString = (value: string) => `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

async function airtable(path = "", init?: RequestInit) {
  const response = await fetch(`${tableUrl()}${path}`, { ...init, headers: { ...headers(), ...(init?.headers || {}) }, cache: "no-store" });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`Airtable ${response.status}: ${body?.error?.message || text || "request failed"}`);
  return body;
}

async function listStored(namespace: string): Promise<Stored[]> {
  const output: Stored[] = [];
  let offset = "";
  do {
    const query = new URLSearchParams({ filterByFormula: `{Namespace}=${formulaString(namespace)}`, pageSize: "100" });
    if (offset) query.set("offset", offset);
    const body = await airtable(`?${query}`);
    for (const row of body.records || []) {
      const fields = row.fields || {};
      output.push({ airtableId: row.id, namespace: fields.Namespace, kind: fields.Kind, recordId: fields.RecordId, payload: JSON.parse(fields.Payload || "null") });
    }
    offset = body.offset || "";
  } while (offset);
  return output;
}

async function writeRecords(namespace: string, records: { kind: Kind; recordId: string; payload: unknown }[]) {
  const existing = new Map((await listStored(namespace)).map((row) => [`${row.kind}:${row.recordId}`, row.airtableId]));
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const updates = batch.filter((row) => existing.has(`${row.kind}:${row.recordId}`));
    const creates = batch.filter((row) => !existing.has(`${row.kind}:${row.recordId}`));
    if (updates.length) await airtable("?typecast=true", { method: "PATCH", body: JSON.stringify({ records: updates.map((row) => ({ id: existing.get(`${row.kind}:${row.recordId}`), fields: { Namespace: namespace, Kind: row.kind, RecordId: row.recordId, Payload: JSON.stringify(row.payload) } })) }) });
    if (creates.length) await airtable("?typecast=true", { method: "POST", body: JSON.stringify({ records: creates.map((row) => ({ fields: { Namespace: namespace, Kind: row.kind, RecordId: row.recordId, Payload: JSON.stringify(row.payload) } })) }) });
  }
}

export async function namespaceExists(namespace: string) { return (await listStored(namespace)).length > 0; }

export async function loadLedger(namespace: string): Promise<Ledger> {
  const records = await listStored(namespace);
  if (!records.length) throw new Error(`Namespace ${namespace} was not found`);
  return {
    namespace,
    customers: records.filter((x) => x.kind === "customer").map((x) => x.payload) as Ledger["customers"],
    invoices: records.filter((x) => x.kind === "invoice").map((x) => x.payload) as Ledger["invoices"],
    events: records.filter((x) => x.kind === "event").map((x) => x.payload) as Ledger["events"],
    cases: records.filter((x) => x.kind === "case").map((x) => x.payload) as Ledger["cases"],
    actions: records.filter((x) => x.kind === "action").map((x) => x.payload) as Ledger["actions"],
  };
}

export async function saveLedger(ledger: Ledger) {
  await writeRecords(ledger.namespace, [
    ...ledger.customers.map((payload) => ({ kind: "customer" as const, recordId: payload.id, payload })),
    ...ledger.invoices.map((payload) => ({ kind: "invoice" as const, recordId: payload.id, payload })),
    ...ledger.events.map((payload) => ({ kind: "event" as const, recordId: payload.ref, payload })),
    ...ledger.cases.map((payload) => ({ kind: "case" as const, recordId: payload.id, payload })),
    ...ledger.actions.map((payload) => ({ kind: "action" as const, recordId: payload.id, payload })),
  ]);
}

export async function saveAction(namespace: string, action: ReminderAction) {
  await writeRecords(namespace, [{ kind: "action", recordId: action.id, payload: action }]);
}

export async function countSessionDispatches(sessionId: string) {
  let offset = "";
  let count = 0;
  do {
    const query = new URLSearchParams({ filterByFormula: `{Kind}='action'`, pageSize: "100" });
    if (offset) query.set("offset", offset);
    const body = await airtable(`?${query}`);
    for (const row of body.records || []) {
      const action = JSON.parse(row.fields?.Payload || "null") as ReminderAction | null;
      if (action?.session_id === sessionId && ["provider_accepted", "received", "stopped"].includes(action.state)) count += 1;
    }
    offset = body.offset || "";
  } while (offset);
  return count;
}

const secureEqual = (actual: string, expected: string) => {
  const a = Buffer.from(actual); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export function requireReviewAuth(request: NextRequest) {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || request.headers.get("x-review-token") || "";
  if (!secureEqual(supplied, requiredEnv("REVIEW_TOKEN"))) throw new Error("UNAUTHORISED");
}

export function requireCallbackAuth(request: NextRequest) {
  const supplied = request.headers.get("x-make-callback-token") || "";
  if (!secureEqual(supplied, requiredEnv("MAKE_CALLBACK_TOKEN"))) throw new Error("UNAUTHORISED");
}

export function fixedAlias() { return process.env.FIXED_RECIPIENT_ALIAS || "HOMEWORK_TEST_INBOX"; }
export function reviewSessionId() { return process.env.REVIEW_SESSION_ID || "default-review-session"; }

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  const status = message === "UNAUTHORISED" ? 401 : message.includes("not found") ? 404 : 400;
  return NextResponse.json({ ok: false, error: message === "UNAUTHORISED" ? "Unauthorised" : message }, { status });
}
