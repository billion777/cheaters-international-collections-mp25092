# Setup and test route

This submission belongs to **Maksims Panuskins (mp25092)**. All records and recipients must remain fictional.

Deployed test route: <https://mp25092-vercel.vercel.app>

Source repository: <https://github.com/billion777/cheaters-international-collections-mp25092>

Configured Make delivery scenario: <https://eu1.make.com/3083425/scenarios/7822202/edit>

## 1. Airtable

Create a homework-only base and one table named `CollectionsRecords`. Add four single-line text fields with these exact names: `Namespace`, `Kind`, `RecordId`, and `Payload`. Keep Airtable's primary field if required; it is not used. Create a personal access token limited to record read/write access for this base only. Do not commit it.

The generic record table still preserves the five required record kinds: `customer`, `invoice`, `event`, `case`, and `action`. `Payload` holds the contract JSON; `Namespace`, `Kind`, and `RecordId` provide scoped lookup and idempotency.

## 2. Make and the dedicated test inbox

Create a dedicated test mailbox that is not your everyday address. The deployed submission currently has the sequential delivery scenario below. Its completed live delivery test and manual inbox verification are documented in `TEST_EVIDENCE.md`.

For fully automatic receipt confirmation, build the second watcher scenario described below:

1. **Sequential delivery scenario:** Custom Webhook → verify `x-make-secret` → reject unless `recipient_alias` equals `HOMEWORK_TEST_INBOX` → send email to a recipient address hard-coded in the email module → Webhook Response. Turn sequential processing on and set the response to JSON such as `{"accepted":true,"delivery_reference":"{{messageId}}"}`. Include action ID, invoice ID, EUR amount, and due date in both subject and body. Never map a request field into the email To field.
2. **Inbox receipt scenario (not yet configured in Make):** Watch the dedicated inbox → extract the action ID, invoice ID, amount, due date, and provider message/delivery reference → POST them to `callback_url` with header `x-make-callback-token`. The JSON body is `namespace`, `action_id`, `invoice_id`, `amount_cents`, `due_date`, `delivery_reference`, and `received_at`. This watcher proves arrival in the actual inbox; the first webhook acknowledgement alone does not. Until it is configured, an authorised reviewer who has visually verified the inbox can submit the same evidence to `/api/actions/confirm-receipt` with the review token.

If Make or the inbox result is ambiguous, the app records `stopped` and will not retry.

## 3. GitHub and Vercel

Push this folder as its own GitHub repository. Import that repository in Vercel with the Next.js preset. Add every variable from `.env.example` in Vercel Project Settings. Generate long random, different values for `REVIEW_TOKEN`, `MAKE_WEBHOOK_SECRET`, and `MAKE_CALLBACK_TOKEN`. Set `APP_BASE_URL` to the final HTTPS Vercel URL and redeploy.

Do not prefix secrets with `NEXT_PUBLIC_`. Share the limited `REVIEW_TOKEN` only through the course's private submission route. Give the reviewer direct read-only Airtable access and direct access to the dedicated inbox/receipt view.

## 4. Exact test sequence

Use a new namespace each time, for example `mp25092-review-a`.

```bash
export COLLECTIONS_BASE_URL=https://YOUR-PROJECT.vercel.app
export COLLECTIONS_REVIEW_TOKEN='PRIVATE_REVIEW_TOKEN'
python3 collections-skill/scripts/collections_cli.py import mp25092-review-a public/practice.json
python3 collections-skill/scripts/collections_cli.py plan mp25092-review-a 2027-03-15
python3 collections-skill/scripts/collections_cli.py prepare mp25092-review-a I1 2027-03-15
```

The plan must match `practice_results.json`. After explicit human authorisation of the returned stable action ID, I1, 3000 cents, `HOMEWORK_TEST_INBOX`, and 2027-03-15:

```bash
python3 collections-skill/scripts/collections_cli.py authorise mp25092-review-a ACTION_ID I1 3000 HOMEWORK_TEST_INBOX 2027-03-15
python3 collections-skill/scripts/collections_cli.py dispatch mp25092-review-a ACTION_ID
python3 collections-skill/scripts/collections_cli.py action mp25092-review-a ACTION_ID
```

Confirm the action reaches `received`, then inspect the matching Airtable action and actual inbox message. Run the same dispatch command again; it must report `dispatched: false` and send no second email.

For the stale-draft test, import a separate namespace, prepare and authorise I1, save the following as `late-payment.json`, append it, then dispatch the old action:

```json
{"ref":"P1-LATE","seq":8,"date":"2027-03-15","type":"payment","amount_cents":6000,"invoice_id":"I1","customer_id":"C1"}
```

```bash
python3 collections-skill/scripts/collections_cli.py append-event mp25092-review-b late-payment.json
python3 collections-skill/scripts/collections_cli.py dispatch mp25092-review-b ACTION_ID
```

Expected result: zero I1 debt, action state `cancelled`, and no Make call/email.
