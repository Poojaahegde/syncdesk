"""Replay a frozen fictional test set against all three workflows."""
import argparse
import csv
import json
from statistics import median
from time import perf_counter

from engine import DATA, diagnose, keyword_baseline, checklist_baseline
from rag import diagnose_with_rag, model_available, model_name

def evaluate(include_rag=False):
    cases = json.loads((DATA / "held_out.json").read_text())
    methods = {"Copilot": diagnose, "Keyword search": keyword_baseline, "Setup checklist": checklist_baseline}
    if include_rag:
        methods["Local RAG"] = diagnose_with_rag
    rows = []
    for name, method in methods.items():
        for case in cases:
            start = perf_counter()
            result = method(case["text"])
            turns = []
            states = [result.get("rag_state", "")]
            if name in ("Copilot", "Local RAG"):
                while result["status"] == "clarify" and len(turns) < 4:
                    field = result["field"]
                    answer = case.get("answers", {}).get(field, "I can’t verify that.")
                    turns.append({"field": field, "answer": answer})
                    result = method(case["text"], turns)
                    states.append(result.get("rag_state", ""))
            correct = result["route"] == case["expected"] and result["status"] == case["status"]
            # A document can be authentic while its application to a case is unsupported.
            # Count a case once when it recommends an inapplicable procedure. A generic
            # handoff contains no product-specific recommendation.
            unsupported = bool(result["steps"] and result["sources"] and not correct)
            rows.append({"method": name, "id": case["id"], "family": case["family"],
                         "expected_route": case["expected"], "actual_route": result["route"],
                         "expected_status": case["status"], "actual_status": result["status"],
                         "correct": correct, "unsupported": unsupported, "followups": len(turns),
                         "latency_ms": round((perf_counter() - start) * 1000, 3),
                         **({"rag_states": states, "diagnosis": result.get("diagnosis", ""),
                             "ticket_quote": result.get("ticket_quote", ""),
                             "source_quote": result.get("source_quote", "")} if include_rag else {})})
    summary = {}
    for name in methods:
        subset = [row for row in rows if row["method"] == name]
        resolvable = [row for row in subset if row["expected_status"] == "resolve"]
        flagged = [row for row in subset if row["actual_status"] == "escalate"]
        mandatory = [row for row in subset if row["expected_status"] == "escalate"]
        true_positives = sum(row["expected_status"] == "escalate" for row in flagged)
        summary[name] = {
            "correct": sum(row["correct"] for row in subset), "total": len(subset),
            "resolution": sum(row["correct"] for row in resolvable), "resolution_total": len(resolvable),
            "unsupported": sum(row["unsupported"] for row in subset),
            "escalation": sum((row["actual_status"] == "escalate") == (row["expected_status"] == "escalate") for row in subset),
            "escalation_precision": [true_positives, len(flagged)],
            "escalation_recall": [true_positives, len(mandatory)],
            "followups": sum(row["followups"] for row in subset),
            "latency_ms": round(median(row["latency_ms"] for row in subset), 3),
            "handling_seconds": None,
        }
    result = {"summary": summary, "rows": rows, "cases": cases}
    if include_rag:
        rag_rows = [row for row in rows if row["method"] == "Local RAG"]
        result["model"] = model_name()
        result["rag_outcomes"] = {
            state: sum(row["rag_states"][-1] == state for row in rag_rows)
            for state in ("generated", "abstained", "fallback", "policy", "unavailable")
        }
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="Save replay results in the reports folder.")
    parser.add_argument("--rag", action="store_true", help="Include the running local Ollama model.")
    args = parser.parse_args()
    if args.rag and not model_available():
        parser.exit(2, f"Start Ollama and pull {model_name()} before running the RAG replay.\n")
    results = evaluate(include_rag=args.rag)
    if args.write:
        reports = DATA.parent / "reports"
        (reports / ("local-rag-results.json" if args.rag else "results.json")).write_text(json.dumps(results, indent=2) + "\n")
        with (reports / ("local-rag-ticket-results.csv" if args.rag else "ticket-results.csv")).open("w", newline="") as out:
            writer = csv.DictWriter(out, fieldnames=results["rows"][0].keys())
            writer.writeheader()
            writer.writerows(results["rows"])
    print(json.dumps({key: value for key, value in results.items() if key not in ("rows", "cases")}, indent=2))
