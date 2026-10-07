# Production test evidence

Student: Maksims Panuskins (`mp25092`)

Production route: <https://mp25092-vercel.vercel.app>

## Financial cases

- Official namespace: `ci-practice-v3`
- As-of date: `2027-03-15`
- The live `/api/plan` JSON was compared with `practice_expected.json` using a structural JSON equality check: `true`.
- Totals: outstanding EUR 422.90; customer credit EUR 20.00; overdue EUR 328.90; disputed EUR 30.00; unallocated EUR 100.00; cash received EUR 289.00; refunds EUR 79.00; net cash EUR 210.00; eligible EUR 30.00.
- All six invoice rows, reasons, ageing bands and eligible amounts matched the supplied expected file.

## Stale proposal test

- Namespace: `ci-stale-mp25092-final`
- Action: `RA-370c25ee188cf4f7`
- A EUR 60.00 late payment was appended after authorisation.
- Dispatch result: `dispatched: false`, `stale_proposal_cancelled: true`.
- Final state: `cancelled`; current I1 debt and eligible amount were both zero.
- Make was not called and no email was sent.

## Delivery and duplicate-suppression test

- Namespace: `ci-delivery-mp25092-final`
- Action: `RA-5dec646d5e99dd8e`
- Invoice: `I1`; authorised amount: EUR 30.00; due date: `2027-03-10`.
- Fixed alias: `HOMEWORK_TEST_INBOX`; the actual dedicated Gmail address remains private in Make configuration.
- Make accepted the request and Gmail showed exactly one inbox message with the subject `[FICTIONAL TEST] Payment reminder RA-5dec646d5e99dd8e | I1 | EUR 30.00 | due 2027-03-10`.
- Inbox receipt was manually verified and attached through the review-authenticated `/api/actions/confirm-receipt` route.
- Final action state: `received`; delivery reference: `make:RA-5dec646d5e99dd8e`.
- A second dispatch request returned `dispatched: false` and `duplicate_suppressed: true`; the Gmail search still showed one message.

## Safety observation

An earlier action, `RA-ba2a7ac8fa25d4cc`, was safely placed in `stopped` after Make returned an ambiguous acknowledgement. The Make log and Gmail search confirmed that its Gmail module was skipped and no message was sent. It was not retried.
