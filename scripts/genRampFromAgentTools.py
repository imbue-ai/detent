"""Regenerate src/schemas/builtin/ramp.json from Ramp's agent-tools OpenAPI spec.

Every Ramp permission is keyed off the scope the agent-tool endpoint declares in
its OpenAPI `security` block, and its JSON-Schema `path`/`method` match the ACTUAL
agent-tool request shape -- which is almost always POST /developer/v1/agent-tools/<tool>
with a `rationale` body, even for reads. (A handful of capabilities are plain REST
paths: /applications, /banking/agent-account-numbers, /bank-accounts.)

Run:  python3 scripts/genRampFromAgentTools.py /abs/path/to/agent-tool-production.json
Writes src/schemas/builtin/ramp.json next to this script's repo root.
"""
import collections
import json
import re
import sys
from pathlib import Path

SPEC = sys.argv[1] if len(sys.argv) > 1 else "/Users/prestonseay/.config/ramp/agent-tool-production.json"
OUT = Path(__file__).resolve().parent.parent / "src" / "schemas" / "builtin" / "ramp.json"

# Non-agent-tools capabilities are plain REST resources; map each to a base path regex.
NON_AT_BASE = {
    "/developer/v1/applications": r"/developer/v[0-9]+/applications",
    "/developer/v1/banking/agent-account-numbers": r"/developer/v[0-9]+/banking/agent-account-numbers",
    "/developer/v1/bank-accounts": r"/developer/v[0-9]+/bank-accounts",
}

RESOURCE_LABEL = {
    "agent_account_numbers": "agent card account numbers",
    "ai_spend": "AI token spend",
    "purchase_orders": "purchase orders",
    "unified_requests": "unified requests (approvals inbox)",
    "x402": "x402 protocol payments",
    "treasury": "treasury / business account balances",
    "cards": "cards",
    "limits": "spend limits & allocations",
    "bills": "bills",
    "reimbursements": "out-of-pocket reimbursements",
    "transactions": "card transactions",
    "vendors": "vendors",
    "trips": "travel & trips",
    "users": "users & org chart",
    "accounting": "accounting / analyst queries",
    "memos": "transaction memos",
    "tasks": "attention feed / tasks",
    "approvals": "approval decisions",
    "comments": "comments",
    "funds": "agent-card funds",
    "receipts": "receipts",
    "applications": "Ramp application (financing onboarding)",
    "bank_accounts": "linked bank accounts",
}


def perm_name(scope):
    if scope == "none":
        return "ramp-read-help-center"
    resource, action = scope.split(":")
    verb = "read" if action.startswith("read") else "write"
    return f"ramp-{verb}-{resource.replace('_', '-')}"


def is_read(scope):
    return scope == "none" or scope.split(":")[1].startswith("read")


def resource_label(scope):
    if scope == "none":
        return "Ramp help-center articles"
    res = scope.split(":")[0]
    return RESOURCE_LABEL.get(res, res.replace("_", " "))


def humanize(slug):
    return slug.replace("-", " ")


def build_method(methods):
    ms = sorted(set(methods))
    return {"const": ms[0]} if len(ms) == 1 else {"enum": ms}


def build_pattern(paths):
    paths = sorted(set(paths))
    at_slugs = sorted({p.rsplit("/", 1)[-1] for p in paths if "/agent-tools/" in p})
    bases = set()
    for p in paths:
        if "/agent-tools/" in p:
            continue
        for raw, pat in NON_AT_BASE.items():
            if p == raw or p.startswith(raw + "/"):
                bases.add(pat)
                break
    groups = []
    if at_slugs:
        # Tool slugs are [a-z0-9-] only; a literal hyphen is safe in a JS regex
        # outside a character class. Do NOT re.escape (it emits "\-", which is an
        # "Invalid escape" under JavaScript's unicode-mode RegExp).
        assert all(re.fullmatch(r"[a-z0-9-]+", s) for s in at_slugs), at_slugs
        groups.append(r"/developer/v[0-9]+/agent-tools/(" + "|".join(at_slugs) + ")")
    for b in sorted(bases):
        groups.append(b + r"(/.*)?")
    return "^(" + "|".join(groups) + ")$"


def surface_note(paths, methods):
    at = any("/agent-tools/" in p for p in paths)
    rest = any("/agent-tools/" not in p for p in paths)
    ms = sorted(set(methods))
    msj = "/".join(ms)
    if at and not rest:
        if ms == ["POST"]:
            return "Ramp agent-tools API (POST with a rationale body)."
        return f"Ramp agent-tools API ({msj})."
    if rest and not at:
        return f"Ramp REST API ({msj})."
    return f"Ramp agent-tools + REST API ({msj})."


def main():
    spec = json.load(open(SPEC))
    by_scope = collections.defaultdict(list)  # scope -> list[(method, path)]
    for path, ops in spec.get("paths", {}).items():
        for method, op in ops.items():
            if not isinstance(op, dict):
                continue
            scopes = set()
            for sec in op.get("security", []):
                for _, vals in sec.items():
                    for sc in (vals or []):
                        scopes.add(sc)
            scope = sorted(scopes)[0] if scopes else "none"
            by_scope[scope].append((method.upper(), path))

    out = {}
    # 1) the umbrella scope (domain match)
    out["ramp-api"] = {
        "$comment": "Any request to the Ramp developer API, in production or the demo (sandbox) environment. This is the whole-service scope; grant a narrower ramp-<verb>-<resource> permission to limit what the agent can do.",
        "properties": {"domain": {"type": "string", "pattern": r"^(demo-)?api\.ramp\.com$"}},
        "required": ["domain"],
    }

    read_paths, read_methods, write_paths, write_methods = [], [], [], []
    perms = {}
    for scope, eps in by_scope.items():
        name = perm_name(scope)
        methods = [m for m, _ in eps]
        paths = [p for _, p in eps]
        caps = ", ".join(sorted({humanize(p.rsplit("/", 1)[-1]) for p in paths}))
        verb = "Read" if is_read(scope) else "Create or modify"
        comment = f"{verb} {resource_label(scope)}. {surface_note(paths, methods)} Capabilities: {caps}."
        perms[name] = {
            "$comment": comment,
            "properties": {"method": build_method(methods), "path": {"type": "string", "pattern": build_pattern(paths)}},
            "required": ["method", "path"],
        }
        if is_read(scope):
            read_paths += paths
            read_methods += methods
        else:
            write_paths += paths
            write_methods += methods

    # 2) aggregate read-all / write-all (path-based, since agent-tools reads are POST)
    out["ramp-read-all"] = {
        "$comment": "Read anything from Ramp: every read capability across all resources (transactions, cards, bills, reimbursements, treasury, vendors, users, accounting, trips, limits, and more). Agent-tools reads are POST with a rationale body.",
        "properties": {"method": build_method(read_methods), "path": {"type": "string", "pattern": build_pattern(read_paths)}},
        "required": ["method", "path"],
    }
    out["ramp-write-all"] = {
        "$comment": "Create or modify anything in Ramp: every write capability across all resources (activate/lock cards, approve transactions & reimbursements, edit limits, issue funds, manage trips & vendors, pay via x402, and more). Agent-tools writes are POST with a rationale body.",
        "properties": {"method": build_method(write_methods), "path": {"type": "string", "pattern": build_pattern(write_paths)}},
        "required": ["method", "path"],
    }

    for name in sorted(perms):
        out[name] = perms[name]

    OUT.write_text(json.dumps(out, indent=2) + "\n")
    print(f"wrote {OUT} with {len(out)} schemas")
    print("permissions:")
    for k in out:
        print(f"  {k}")


if __name__ == "__main__":
    main()
