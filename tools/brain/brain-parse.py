#!/usr/bin/env python3
"""Brain CLI output parser. Called by brain script with: brain-parse.py <command> < json_input"""
import sys, json

def check_auth_error(d):
    """Check for auth errors and print actionable guidance."""
    err = d.get("error", "")
    if "revoked" in err.lower() or "invalid" in err.lower() or err == "Authentication required":
        print("ERROR: Brain API key is invalid or has been revoked.", file=sys.stderr)
        print("", file=sys.stderr)
        print("ACTION REQUIRED: Ask the user to provide a new API key.", file=sys.stderr)
        print("  1. Go to https://mindspace.xpollination.earth/settings and copy the API key.", file=sys.stderr)
        print("  2. Paste the key here.", file=sys.stderr)
        print("  3. I will run: brain setup <KEY>", file=sys.stderr)
        sys.exit(1)

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "generic"
    try:
        d = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("ERROR: Invalid JSON response from brain API", file=sys.stderr)
        sys.exit(1)

    # Check auth errors before any command processing
    if "error" in d:
        check_auth_error(d)

    if cmd == "health":
        status = d.get("status", "?")
        qdrant = d.get("qdrant", "?")
        print(f"Status: {status}")
        print(f"Qdrant: {qdrant}")
        for k, v in d.get("collections", {}).items():
            print(f"  {k}: {v} vectors")

    elif cmd == "query":
        r = d.get("result", {})
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        sources = r.get("sources", [])
        print(f"Found {len(sources)} thoughts:")
        for i, s in enumerate(sources):
            score = s.get("score", 0)
            contrib = s.get("contributor", "?")
            preview = s.get("content_preview", "")[:120]
            if s.get("content"):
                preview = s["content"][:200]
            cat = s.get("thought_category", "")
            topic = s.get("topic", "")
            meta = f" [{cat}]" if cat else ""
            meta += f" #{topic}" if topic else ""
            print(f"\n  [{i+1}] ({score:.2f}) {contrib}{meta}")
            print(f"      {preview}")
            tid = s.get("thought_id")
            if tid:
                print(f"      id: {tid}")
        g = r.get("guidance")
        if g:
            print(f"\nGuidance: {g}")

    elif cmd == "contribute":
        r = d.get("result", {})
        t = r.get("trace", {})
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        c = t.get("thoughts_contributed", 0)
        met = t.get("contribution_threshold_met", False)
        if c and c > 0:
            print(f"OK: {c} thought(s) contributed")
        elif not met:
            g = r.get("guidance", "")
            if g and "Similar thought" in g:
                print("SKIPPED: Similar thought already exists.")
                print(f"  {g[:200]}")
                print('  Use: brain refine <id> "updated content"')
            else:
                print("SKIPPED: Contribution threshold not met.")
                print("  Make the content more specific or declarative.")
        else:
            print(f"OK (contributed: {c}, threshold: {met})")

    elif cmd == "refine":
        t = d.get("result", {}).get("trace", {})
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        print(f"Refined: contributed={t.get('thoughts_contributed', 0)}")

    elif cmd == "supersede":
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        print("OK: Thought superseded.")

    elif cmd == "correct":
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        print("OK: Correction recorded.")

    elif cmd == "thought":
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        t = d.get("thought", d)
        print(f"ID: {t.get('thought_id', '?')}")
        print(f"Contributor: {t.get('contributor_name', '?')}")
        print(f"Category: {t.get('thought_category', '?')}")
        print(f"Topic: {t.get('topic', '?')}")
        print(f"Superseded: {t.get('superseded', False)}")
        print(f"Refined by: {t.get('refined_by', 'none')}")
        print("---")
        print(t.get("content", t.get("content_preview", "no content")))

    elif cmd == "recovery":
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        print(json.dumps(d, indent=2))

    elif cmd == "domains":
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        domains = d if isinstance(d, list) else d.get("domains", d.get("result", []))
        if isinstance(domains, list):
            for dom in domains[:30]:
                if isinstance(dom, dict):
                    print(f"  {dom.get('tag', dom.get('domain', '?'))}: {dom.get('count', '?')} thoughts")
                else:
                    print(f"  {dom}")
        else:
            print(json.dumps(d, indent=2))

    elif cmd == "share":
        if "error" in d:
            print(f"ERROR: {d['error']}")
            sys.exit(1)
        print(f"OK: Shared as {d.get('shared_thought_id', '?')}")

    elif cmd == "setup":
        if d.get("status") == "ok":
            qdrant = d.get("qdrant", "?")
            cols = d.get("collections", {})
            print(f"Connection OK: Qdrant={qdrant}, collections={cols}")
        else:
            print("WARNING: Unexpected response")
            print(json.dumps(d))

    else:
        print(json.dumps(d, indent=2))

if __name__ == "__main__":
    main()
