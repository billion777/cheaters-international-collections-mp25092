"use client";

import { useEffect, useMemo, useState } from "react";
import type { Ledger, Plan, ReminderAction } from "@/lib/types";

const euro = (cents: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);

export default function Home() {
  const [token, setToken] = useState("");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [namespace, setNamespace] = useState("ci-practice-mp25092");
  const [asOf, setAsOf] = useState("2027-03-15");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [action, setAction] = useState<ReminderAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Load the supplied practice ledger to begin.");

  useEffect(() => { setToken(sessionStorage.getItem("review-token") || ""); }, []);
  const api = async (path: string, method = "GET", body?: unknown) => {
    setBusy(true);
    try {
      sessionStorage.setItem("review-token", token);
      const response = await fetch(path, { method, headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Request failed");
      return result;
    } finally { setBusy(false); }
  };
  const loadPractice = async () => {
    const data = await fetch("/practice.json").then((r) => r.json()) as Ledger;
    data.namespace = namespace;
    setLedger(data); setPlan(null); setAction(null); setMessage("Practice ledger loaded locally. Import creates a new isolated Airtable namespace.");
  };
  const importLedger = async () => {
    if (!ledger) return;
    try { await api("/api/namespaces/import", "POST", { ...ledger, namespace }); setMessage(`Imported ${namespace}.`); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Import failed"); }
  };
  const runPlan = async () => {
    try { const result = await api("/api/plan", "POST", { namespace, as_of: asOf }); setPlan(result); setAction(null); setMessage("Read-only plan complete. Nothing was sent."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Plan failed"); }
  };
  const prepare = async (invoiceId: string) => {
    try { const result = await api("/api/actions/prepare", "POST", { namespace, invoice_id: invoiceId, as_of: asOf }); setAction(result.action); setMessage("Proposal saved. It is not authorised and has not been sent."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Prepare failed"); }
  };
  const authorise = async () => {
    if (!action) return;
    try {
      const result = await api("/api/actions/authorise", "POST", { namespace, action_id: action.id, invoice_id: action.invoice_id, amount_cents: action.approved_amount_cents, recipient_alias: action.approved_recipient_alias, as_of: action.approved_as_of });
      setAction(result.action); setMessage("Exact snapshot authorised. Dispatch is still a separate step and will re-read Airtable.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Authorisation failed"); }
  };
  const dispatch = async () => {
    if (!action) return;
    try { const result = await api("/api/actions/dispatch", "POST", { namespace, action_id: action.id }); setAction(result.action); setMessage(result.dispatched ? "Make accepted the delivery request. Check the recorded receipt state." : "No email sent; duplicate or changed facts were safely suppressed."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Dispatch stopped"); }
  };
  const eligible = useMemo(() => plan?.invoices.filter((x) => x.eligible_cents > 0) || [], [plan]);

  return <main>
    <header className="hero">
      <div className="brand"><span className="mark">CI</span><span>CHEATERS INTERNATIONAL <small>fictional training ledger</small></span></div>
      <p className="eyebrow">COLLECTIONS CONTROL / MP25092</p>
      <h1>Know who owes.<br/><em>Leave everyone else alone.</em></h1>
      <p className="intro">A read-first control desk for fictional receivables. Every reminder is calculated in cents, explicitly approved, rechecked against Airtable, and delivered only through the fixed Make route.</p>
      <div className="guardrails"><span>01 · PLAN FIRST</span><span>02 · EXACT APPROVAL</span><span>03 · RECHECK BEFORE SEND</span></div>
    </header>

    <section className="control panel">
      <div><p className="kicker">REVIEW ROUTE</p><h2>Open a test namespace</h2></div>
      <div className="fields">
        <label>Review token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Kept in this browser session" /></label>
        <label>Namespace<input value={namespace} onChange={(e) => setNamespace(e.target.value)} /></label>
        <label>As-of date<input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></label>
      </div>
      <div className="buttons"><button onClick={loadPractice} disabled={busy}>Load practice</button><button className="secondary" onClick={importLedger} disabled={!ledger || busy}>Import once</button><button className="dark" onClick={runPlan} disabled={busy}>Run read-only plan</button></div>
      <p className="status">{busy ? "Working…" : message}</p>
    </section>

    {plan && <>
      <section className="metrics">
        <Metric label="Total debt" value={euro(plan.totals.outstanding_cents)} /><Metric label="Customer credit" value={euro(plan.totals.customer_credit_cents)} />
        <Metric label="Unallocated cash" value={euro(plan.totals.unallocated_cents)} /><Metric label="Eligible now" value={euro(plan.totals.eligible_cents)} accent />
      </section>
      <section className="panel"><div className="section-head"><div><p className="kicker">INVOICE PLAN</p><h2>{plan.as_of}</h2></div><span>{eligible.length} proposed action{eligible.length === 1 ? "" : "s"}</span></div>
        <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Debt</th><th>Credit</th><th>Age</th><th>Protected</th><th>Eligible</th><th>Decision</th></tr></thead><tbody>
          {plan.invoices.map((row) => <tr key={row.id}><td><strong>{row.id}</strong></td><td>{euro(row.outstanding_cents)}</td><td>{euro(row.customer_credit_cents)}</td><td>{row.age_band.replace("_", "–")}</td><td>{euro(row.disputed_cents)}</td><td className="eligible">{euro(row.eligible_cents)}</td><td>{row.eligible_cents ? <button className="mini" onClick={() => prepare(row.id)}>Prepare</button> : <span className="pill">{row.reasons.join(" · ")}</span>}</td></tr>)}
        </tbody></table></div>
      </section>
    </>}

    {action && <section className="panel action-card"><div><p className="kicker">STABLE ACTION · {action.id}</p><h2>{action.invoice_id} / {euro(action.approved_amount_cents || 0)}</h2><p>Recipient: <strong>{action.approved_recipient_alias}</strong> · Snapshot: {action.approved_as_of}</p></div><div className={`state ${action.state}`}>{action.state}</div>
      <div className="action-buttons">{action.state === "prepared" && <button onClick={authorise}>Authorise exact snapshot</button>}{action.state === "authorised" && <button className="danger" onClick={dispatch}>Dispatch through Make</button>}{["provider_accepted", "received", "stopped", "cancelled"].includes(action.state) && <button className="secondary" onClick={dispatch}>Repeat same action (safety test)</button>}</div>
      {action.delivery_reference && <p className="evidence">Delivery reference: <code>{action.delivery_reference}</code>{action.received_at && <> · received {action.received_at}</>}</p>}
      {action.stop_reason && <p className="warning">{action.stop_reason}</p>}
    </section>}

    <footer><span>Built by Maksims Panuskins · mp25092</span><span>Fictional data only · No automatic schedules · Maximum 3 sends</span></footer>
  </main>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className={`metric ${accent ? "accent" : ""}`}><span>{label}</span><strong>{value}</strong></div>; }
