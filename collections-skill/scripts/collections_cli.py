#!/usr/bin/env python3
"""Small dependency-free client for the fictional collections review route."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("COLLECTIONS_BASE_URL", "").rstrip("/")
TOKEN = os.environ.get("COLLECTIONS_REVIEW_TOKEN", "")

def request(path, method="GET", body=None):
    if not BASE or not TOKEN:
        raise SystemExit("Set COLLECTIONS_BASE_URL and COLLECTIONS_REVIEW_TOKEN privately first.")
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(BASE + path, data=data, method=method, headers={"Authorization": "Bearer " + TOKEN, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8")
        raise SystemExit(f"HTTP {error.code}: {detail}") from error

def load(path):
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)

def main():
    parser = argparse.ArgumentParser(description="Cheaters International fictional collections client")
    sub = parser.add_subparsers(dest="command", required=True)
    for name in ("read",):
        p = sub.add_parser(name); p.add_argument("namespace")
    p = sub.add_parser("import"); p.add_argument("namespace"); p.add_argument("file")
    p = sub.add_parser("plan"); p.add_argument("namespace"); p.add_argument("as_of")
    p = sub.add_parser("prepare"); p.add_argument("namespace"); p.add_argument("invoice_id"); p.add_argument("as_of")
    p = sub.add_parser("authorise"); p.add_argument("namespace"); p.add_argument("action_id"); p.add_argument("invoice_id"); p.add_argument("amount_cents", type=int); p.add_argument("recipient_alias"); p.add_argument("as_of")
    p = sub.add_parser("dispatch"); p.add_argument("namespace"); p.add_argument("action_id")
    p = sub.add_parser("append-event"); p.add_argument("namespace"); p.add_argument("file")
    p = sub.add_parser("action"); p.add_argument("namespace"); p.add_argument("action_id")
    args = parser.parse_args()
    if args.command == "read": result = request("/api/namespaces/" + urllib.parse.quote(args.namespace, safe=""))
    elif args.command == "import":
        ledger = load(args.file); ledger["namespace"] = args.namespace
        result = request("/api/namespaces/import", "POST", ledger)
    elif args.command == "plan": result = request("/api/plan", "POST", {"namespace": args.namespace, "as_of": args.as_of})
    elif args.command == "prepare": result = request("/api/actions/prepare", "POST", {"namespace": args.namespace, "invoice_id": args.invoice_id, "as_of": args.as_of})
    elif args.command == "authorise": result = request("/api/actions/authorise", "POST", {"namespace": args.namespace, "action_id": args.action_id, "invoice_id": args.invoice_id, "amount_cents": args.amount_cents, "recipient_alias": args.recipient_alias, "as_of": args.as_of})
    elif args.command == "dispatch": result = request("/api/actions/dispatch", "POST", {"namespace": args.namespace, "action_id": args.action_id})
    elif args.command == "append-event": result = request("/api/events/append", "POST", {"namespace": args.namespace, "event": load(args.file)})
    else: result = request("/api/actions/" + urllib.parse.quote(args.action_id, safe="") + "?namespace=" + urllib.parse.quote(args.namespace, safe=""))
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
