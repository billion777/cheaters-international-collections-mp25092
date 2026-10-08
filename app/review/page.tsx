import { calculatePlan } from "@/lib/collections";
import { REVIEW_ACTION_ID, REVIEW_ACTION_NAMESPACE, REVIEW_PLAN_AS_OF, REVIEW_PLAN_NAMESPACE } from "@/lib/review";
import { loadLedger } from "@/lib/server";

export const dynamic = "force-dynamic";

const euro = (cents: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(cents / 100);
const repo = "https://github.com/billion777/cheaters-international-collections-mp25092";
const airtableEvidence = "https://airtable.com/app1PIMoXvc7LaE8S/shrCFhltPJgDTkQTk";
const originalEmail = "https://drive.google.com/file/d/145I0KCoRRbCtZmwssg95W9pjlETPO4ka/view?usp=sharing";

export default async function ReviewPage() {
  const [planLedger, actionLedger] = await Promise.all([
    loadLedger(REVIEW_PLAN_NAMESPACE),
    loadLedger(REVIEW_ACTION_NAMESPACE),
  ]);
  const plan = calculatePlan(planLedger, REVIEW_PLAN_AS_OF);
  const action = actionLedger.actions.find((item) => item.id === REVIEW_ACTION_ID);

  return <main>
    <header className="hero review-hero">
      <div className="brand"><span className="mark">CI</span><span>START HERE <small>restricted reviewer access / mp25092</small></span></div>
      <p className="eyebrow">NO LOGIN · NO TOKEN · READ ONLY</p>
      <h1>Verify the existing work.<br/><em>Nothing will be sent.</em></h1>
      <p className="intro">This page reads two fixed fictional Airtable namespaces. It cannot import data, prepare or authorise actions, dispatch email, reveal credentials, or access any other namespace.</p>
    </header>

    <section className="panel">
      <div className="section-head"><div><p className="kicker">SIX-CASE PLAN</p><h2>{REVIEW_PLAN_NAMESPACE}</h2></div><span>AS OF {REVIEW_PLAN_AS_OF}</span></div>
      <p className="status">Loaded live from Airtable through the restricted read-only review route. Expected eligible amount: EUR 30.00.</p>
      <div className="metrics">
        <Metric label="Outstanding" value={euro(plan.totals.outstanding_cents)} />
        <Metric label="Customer credit" value={euro(plan.totals.customer_credit_cents)} />
        <Metric label="Unallocated cash" value={euro(plan.totals.unallocated_cents)} />
        <Metric label="Eligible now" value={euro(plan.totals.eligible_cents)} accent />
      </div>
      <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Debt</th><th>Credit</th><th>Age</th><th>Disputed</th><th>Eligible</th><th>Reason</th></tr></thead><tbody>
        {plan.invoices.map((row) => <tr key={row.id}><td><strong>{row.id}</strong></td><td>{euro(row.outstanding_cents)}</td><td>{euro(row.customer_credit_cents)}</td><td>{row.age_band}</td><td>{euro(row.disputed_cents)}</td><td className="eligible">{euro(row.eligible_cents)}</td><td>{row.reasons.join(" · ")}</td></tr>)}
      </tbody></table></div>
      <p><a href="/api/review/plan">Open the same result as read-only JSON</a></p>
    </section>

    <section className="panel action-card">
      <div><p className="kicker">LIVE AIRTABLE ACTION</p><h2>{action?.id || REVIEW_ACTION_ID}</h2><p>Namespace: <strong>{REVIEW_ACTION_NAMESPACE}</strong> · Invoice: {action?.invoice_id} · Amount: {euro(action?.approved_amount_cents || 0)}</p></div>
      <div className={`state ${action?.state}`}>{action?.state || "not found"}</div>
      <p className="evidence">Delivery reference: <code>{action?.delivery_reference}</code> · received {action?.received_at}</p>
      <p><a href="/api/review/action">Open the restricted live Airtable action JSON</a></p>
      <p><a href={airtableEvidence}>Open the direct read-only Airtable view (received + cancelled actions)</a></p>
    </section>

    <section className="panel">
      <p className="kicker">ORIGINAL INBOX EVIDENCE</p><h2>Received Gmail message</h2>
      <p className="status">Original <code>.eml</code> with message headers, action ID, invoice, amount and due date. Viewer access is granted to <code>ugiss457@gmail.com</code>.</p>
      <p><a href={originalEmail}>Open the original received message in Google Drive</a></p>
      <p className="evidence">This is the existing receipt for <code>RA-5dec646d5e99dd8e</code>. No message was resent.</p>
    </section>

    <section className="panel">
      <p className="kicker">SUBMITTED FILES</p><h2>Reusable skill and evidence</h2>
      <div className="review-links">
        <a href={`${repo}/raw/refs/heads/main/collections-skill-mp25092.zip`}>Download reusable skill ZIP</a>
        <a href={`${repo}/blob/main/collections-skill/SKILL.md`}>Read skill instructions</a>
        <a href={`${repo}/blob/main/practice_results.json`}>Open six-case output</a>
        <a href={`${repo}/blob/main/TEST_EVIDENCE.md`}>Open test evidence</a>
        <a href={`${repo}/blob/main/SETUP.md`}>Open setup instructions</a>
      </div>
      <p className="status">The received action and linked original email are the existing completed test. Do not resend it for review.</p>
    </section>

    <footer><span>Maksims Panuskins · mp25092</span><span>Fictional data only · reviewer route is read-only</span></footer>
  </main>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className={`metric ${accent ? "accent" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}
