# Where Is My Money?

A Vercel-ready fictional collections control for **Maksims Panuskins (mp25092)**. It calculates the supplied accounts-receivable cases in integer cents, stores live records and stable action states in Airtable, and sends only an exactly authorised reminder through a fixed Make/test-inbox route.

## Reviewer start here

Open <https://mp25092-vercel.vercel.app/review>. It requires no token or account and exposes only fixed read-only fictional plan and action evidence. See [START_HERE.md](./START_HERE.md) for direct JSON and submitted-file links.

## Included

- Next.js review dashboard and scoped JSON API
- Contract validation, ageing, disputes, promises, credits, refunds, and unallocated-cash rules
- Stable action IDs, exact approval snapshots, current-ledger recheck, seven-day suppression, and a three-send limit
- Airtable persistence and Make webhook/inbox callback integration
- Fresh-session AI skill ZIP source and dependency-free CLI
- Published practice result plus automated accounting/safety tests

Read [SETUP.md](./SETUP.md) before deployment. The external Airtable base, Make scenarios, dedicated inbox, and Vercel environment secrets are intentionally not embedded in this repository.

## Local verification

```bash
npm test
npm run build
```

The website is a control route, not evidence by itself. Assessment evidence is the matching Airtable action record plus the message seen in the actual dedicated inbox.
