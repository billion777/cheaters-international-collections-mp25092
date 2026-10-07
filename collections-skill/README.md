# Fresh-session route

1. Unzip this folder or install it as a Codex skill.
2. Set `COLLECTIONS_BASE_URL` to the deployed Vercel URL and set `COLLECTIONS_REVIEW_TOKEN` to the private limited review token.
3. Ask the AI to read this `SKILL.md` and plan a named namespace for an explicit as-of date.
4. Review the plan. Explicitly name an action and its exact invoice, cents amount, `HOMEWORK_TEST_INBOX` alias, and date if you want to authorise it.
5. Separately ask to dispatch. Verify `received`, the delivery reference, the Airtable action record, and the message in the dedicated inbox.

The CLI uses only Python's standard library. It never receives or submits an arbitrary email address.
