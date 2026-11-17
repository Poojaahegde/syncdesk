"""Run the Syncdesk demo with Python 3.9+ and no dependencies."""
import argparse
import json
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from engine import DATA, QUESTIONS, SOURCES, diagnose, retrieve, checklist_baseline, custom_sources, public_source
from evaluate import evaluate
from rag import diagnose_with_rag, model_available, model_name

BASE = Path(__file__).parent
ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
}
DEMOS = json.loads((DATA / "demo.json").read_text())


class App(BaseHTTPRequestHandler):
    def send(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def reply(self, data, status=200):
        self.send(status, json.dumps(data).encode(), "application/json; charset=utf-8")

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path in ASSETS:
            filename, mime = ASSETS[url.path]
            self.send(200, (BASE / "static" / filename).read_bytes(), mime)
        elif url.path == "/api/bootstrap":
            self.reply({"tickets": DEMOS, "sources": [public_source(source) for source in SOURCES.values()], "model_available": model_available(), "model": model_name()})
        elif url.path == "/api/evaluate":
            results = evaluate()
            report = BASE / "reports" / "local-rag-results.json"
            if report.is_file():
                saved = json.loads(report.read_text())
                if saved["cases"] == results["cases"]:
                    results["summary"]["Local RAG"] = saved["summary"]["Local RAG"]
                    results["rows"].extend(row for row in saved["rows"] if row["method"] == "Local RAG")
                    results["model"] = saved["model"]
                    results["rag_outcomes"] = saved["rag_outcomes"]
            self.reply(results)
        elif url.path == "/api/search":
            query = parse_qs(url.query).get("q", [""])[0][:300]
            self.reply({"matches": [public_source(source) for source in (retrieve(query) if query.strip() else SOURCES.values())]})
        else:
            self.reply({"error": "Page not found."}, 404)

    def do_POST(self):
        if self.path not in ("/api/diagnose", "/api/handoff", "/api/checklist", "/api/library"):
            self.reply({"error": "Endpoint not found."}, 404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if not 0 < size <= 160000:
                raise ValueError()
            data = json.loads(self.rfile.read(size))
            library = {**SOURCES, **custom_sources(data.get("playbooks", []))}
            if self.path == "/api/library":
                query = data.get("query", "")
                if not isinstance(query, str) or len(query) > 300:
                    raise ValueError("Search must be at most 300 characters.")
                matches = retrieve(query, library) if query.strip() else library.values()
                self.reply({"matches": [public_source(source) for source in matches]})
                return
            ticket = data.get("ticket")
            turns = data.get("turns", [])
            if not isinstance(ticket, str) or not 1 <= len(ticket.strip()) <= 4000:
                raise ValueError()
            if not isinstance(turns, list) or len(turns) > 4:
                raise ValueError()
            for turn in turns:
                if turn.get("field") not in QUESTIONS or not isinstance(turn.get("answer"), str) or not 1 <= len(turn["answer"].strip()) <= 500:
                    raise ValueError()
        except (ValueError, AttributeError, UnicodeError) as error:
            self.reply({"error": str(error) if str(error) else "Enter a ticket (up to 4,000 characters) and valid follow-up answers."}, 400)
            return
        if self.path == "/api/checklist":
            self.reply(checklist_baseline(ticket))
            return
        if self.path == "/api/diagnose":
            method = diagnose_with_rag if data.get("use_model") is True else diagnose
            self.reply(method(ticket, turns, library=library))
            return
        result = diagnose(ticket, turns, library=library)
        candidate_id = data.get("review_source")
        candidate = library.get(candidate_id) if isinstance(candidate_id, str) else None
        model_source = candidate if (candidate and result.get("rag_eligible")
                                     and result["status"] == "clarify"
                                     and result.get("product") == candidate["product"]) else None
        source = result["sources"][0] if result["sources"] else model_source
        self.reply({
            "queue": result["queue"] or (model_source or {}).get("queue") or "Integration support specialist",
            "reason": ("Verify the suggested cause against the cited passage." if model_source else
                       result["reason"] if result["status"] == "escalate" else "Rep requested human review."),
            "ticket": ticket, "turns": turns,
            "source": source["title"] if source else "",
            "url": source["url"] if source else "",
            "created": datetime.now(timezone.utc).isoformat(),
        })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), App)
    print(f"Syncdesk is running at http://127.0.0.1:{args.port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
