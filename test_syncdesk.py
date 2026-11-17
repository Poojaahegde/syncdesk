"""Regression checks for routing, evidence, and abstention."""
import json
import unittest
from unittest.mock import patch

from engine import SOURCES, custom_sources, diagnose, retrieve
from evaluate import evaluate
from rag import diagnose_with_rag


class RoutingTests(unittest.TestCase):
    def test_exact_route_has_cited_procedure(self):
        result = diagnose("Stripe webhook test returns HTTP 302.")
        self.assertEqual((result["status"], result["route"]), ("resolve", "stripe-redirect"))
        self.assertTrue(result["steps"])
        self.assertIn("docs.stripe.com", result["sources"][0]["url"])

    def test_unknown_case_requests_details_then_escalates(self):
        ticket = "The integration won't connect."
        attempts = [{"field":"product", "answer":"Stripe"}]
        self.assertEqual(diagnose(ticket)["field"], "product")
        self.assertEqual(diagnose(ticket, attempts)["field"], "symptom")
        attempts.append({"field":"symptom", "answer":"I can’t verify the error"})
        self.assertEqual(diagnose(ticket, attempts)["status"], "escalate")

    def test_missing_status_can_be_supplied_separately(self):
        ticket = "Stripe webhook did not deliver."
        turns = [{"field":"symptom", "answer":"HTTP 302"}]
        self.assertEqual(diagnose(ticket, turns)["route"], "stripe-redirect")

    def test_conflicts_and_financial_risk(self):
        self.assertEqual(diagnose("Stripe webhook reports HTTP 302 and 500.")["field"], "conflict")
        result = diagnose("Stripe webhook returns HTTP 302 and there are duplicate charges.")
        self.assertEqual(result["status"], "escalate")
        self.assertFalse(result["steps"])

    def test_new_provider_is_data_driven(self):
        source = {"product":"Northstar Sync", "article":"Verify access", "url":"https://example.com/source",
                  "passage":"Fictional QA reference", "trigger":"workspace binding expired",
                  "procedure":"Verify the intended workspace.\nContact its owner.", "queue":"Workspace owner"}
        library = {**SOURCES, **custom_sources([source])}
        result = diagnose("Northstar Sync shows workspace binding expired.", library=library)
        self.assertEqual((result["status"], result["queue"]), ("escalate", "Workspace owner"))
        self.assertEqual(retrieve("Northstar", library)[0]["id"], "custom-0")
        with self.assertRaises(ValueError):
            custom_sources([{**source, "url":"javascript:alert(1)"}])

    def test_local_rag_generates_a_cited_diagnosis_but_uses_reviewed_steps(self):
        ticket = "Stripe webhook test returns HTTP 302."
        generated = {"decision":"diagnose", "source_id":"stripe-redirect",
                     "diagnosis":"The reported HTTP 302 is consistent with a webhook redirect.",
                     "ticket_quote":"HTTP 302",
                     "source_quote":"Set the webhook endpoint destination to the URL resolved by the redirect."}
        with patch("rag.model_available", return_value=True), patch("rag.generate", return_value=generated):
            result = diagnose_with_rag(ticket)
            self.assertEqual(result["mode"], "Local RAG")
            self.assertEqual(result["diagnosis"], generated["diagnosis"])
            self.assertEqual(result["steps"], SOURCES["stripe-redirect"]["steps"])
            generated["source_quote"] = "Pause all payments now."
            self.assertEqual(diagnose_with_rag(ticket)["rag_state"], "abstained")
            generated["source_quote"] = "URL resolved by the redirect"
            generated["source_id"] = "stripe-server"
            self.assertEqual(diagnose_with_rag(ticket)["rag_state"], "abstained")

    def test_rag_uncertain_match_requires_human_review_and_has_no_steps(self):
        ticket = "Google Drive desktop upload cannot proceed because the device storage is exhausted."
        generated = {"decision":"diagnose", "source_id":"drive-disk",
                     "diagnosis":"The report is consistent with a local storage limit.",
                     "ticket_quote":"device storage is exhausted",
                     "source_quote":"You must have enough local storage"}
        with patch("rag.model_available", return_value=True), patch("rag.generate", return_value=generated):
            result = diagnose_with_rag(ticket)
        self.assertEqual((result["status"], result["mode"]), ("escalate", "Local RAG"))
        self.assertFalse(result["steps"])

    def test_rag_unavailable_runs_rules_and_risk_bypasses_model(self):
        with patch("rag.model_available", return_value=False), patch("rag.generate") as generate:
            self.assertEqual(diagnose_with_rag("Stripe webhook returns HTTP 302.")["rag_state"], "unavailable")
            result = diagnose_with_rag("Stripe webhook returns HTTP 302 and there are duplicate charges.")
            self.assertEqual(result["rag_state"], "policy")
            generate.assert_not_called()

    def test_evaluation_counts_and_live_time(self):
        results = evaluate()
        self.assertEqual(len(results["rows"]), 90)
        self.assertEqual(len(results["cases"]), 30)
        self.assertEqual(results["summary"]["Copilot"]["escalation_recall"], [19, 19])
        self.assertTrue(all(row["handling_seconds"] is None for row in results["summary"].values()))
        json.dumps(results)


if __name__ == "__main__":
    unittest.main()
