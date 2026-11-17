"""Retrieve documented playbooks and choose a bounded support action."""
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

DATA = Path(__file__).parent / "data"
SOURCES = {row["id"]: row for row in json.loads((DATA / "sources.json").read_text())}
QUESTIONS = {
    "product": "Which service is showing the error?",
    "symptom": "What exact error or status does the service show?",
    "conflict": "Which of the reported errors is current?",
}
STOP = set("a an the app application our is to in on and we it for my with shows setup integration".split())
UNKNOWN = re.compile(r"^(?:i (?:can.t|don.t)|unknown|unsure|unavailable|not sure|no error)", re.I)


def words(value):
    return set(re.findall(r"[a-z0-9]+", value.lower())) - STOP


def text_has(text, phrase):
    return re.search(r"(?<!\w)" + re.escape(phrase.lower()) + r"(?!\w)", text) is not None


def public_source(source):
    return {key: value for key, value in source.items() if key not in {"signals", "context", "aliases"}}


def custom_sources(items):
    if not isinstance(items, list) or len(items) > 25:
        raise ValueError("Up to 25 custom playbooks are supported.")
    sources = {}
    for index, item in enumerate(items):
        limits = {"product": 80, "article": 140, "url": 500, "passage": 1200, "trigger": 140, "procedure": 1500, "queue": 100}
        fields = {}
        for name, limit in limits.items():
            value = item.get(name, "")
            if not isinstance(value, str) or len(value) > limit or (name != "queue" and not value.strip()):
                raise ValueError(f"Invalid playbook field: {name}.")
            fields[name] = value.strip()
        url = urlsplit(fields["url"])
        if url.scheme != "https" or not url.hostname or url.username or url.password:
            raise ValueError("Use an HTTPS reference URL.")
        if len(words(fields["trigger"])) < 2 and not re.search(r"\d", fields["trigger"]):
            raise ValueError("Use a specific error phrase or code as the trigger.")
        route = f"custom-{index}"
        sources[route] = {
            "id": route, "product": fields["product"], "aliases": [fields["product"].lower()],
            "title": fields["article"], "article": fields["article"], "url": fields["url"],
            "publisher": "Workspace playbook", "section": "User-supplied reference",
            "passage": fields["passage"], "keywords": fields["trigger"],
            "signals": [r"(?<!\w)" + re.escape(fields["trigger"].lower()) + r"(?!\w)"],
            "context": "", "code": fields["trigger"],
            "steps": [step.strip() for step in fields["procedure"].splitlines() if step.strip()],
            "queue": fields["queue"],
        }
    return sources


def retrieve(query, library=None, product=None):
    library = SOURCES if library is None else library
    query_words = words(query)
    scored = []
    for source in library.values():
        if product and source["product"].casefold() != product.casefold():
            continue
        primary = words(source["code"] + " " + source["keywords"])
        secondary = words(source["title"] + " " + source["product"] + " " + source["passage"])
        score = 2 * len(query_words & primary) + len(query_words & secondary)
        if score:
            scored.append((score, source))
    return [source for _, source in sorted(scored, key=lambda item: -item[0])]


def outcome(status, title, reason, route="", source=None, steps=None, queue="", mode="Local"):
    return {"status":status, "title":title, "reason":reason, "route":route,
            "sources":[public_source(source)] if source else [], "steps":steps or [],
            "queue":queue, "choices":[], "mode":mode}


def escalate(reason, route="review", source=None):
    return outcome("escalate", source["title"] if source else "Human review recommended", reason,
                   route, source, source["steps"] if source else [],
                   source.get("queue", "") if source else "Integration support specialist")


def clarify(field, choices, turns):
    if field in {turn["field"] for turn in turns} or len(turns) >= 3:
        return escalate("The required detail is still unverified. Include the exact error and the last known successful sync in the handoff.")
    result = outcome("clarify", "One detail needed", "This detail determines which support procedure applies.", field)
    return dict(result, question=QUESTIONS[field], field=field, choices=choices)


def suggestion(source, mode="Local"):
    if source.get("queue"):
        result = escalate("The documented procedure requires review by the owner below.", source["id"], source)
        return dict(result, mode=mode)
    return outcome("resolve", source["title"], "The reported symptom matches this troubleshooting path.",
                   source["id"], source, source["steps"], mode=mode)


def matches(source, symptom):
    return (not source["context"] or re.search(source["context"], symptom, re.S)) and any(
        re.search(signal, symptom) for signal in source["signals"])


def diagnose(ticket, turns=None, library=None):
    library = SOURCES if library is None else library
    turns = turns or []
    facts = {turn["field"]: turn["answer"].strip().lower().replace("’", "'") for turn in turns}
    initial = ticket.lower().replace("’", "'")
    text = "\n".join([initial, *facts.values()])
    if re.search(r"\b(?:data loss|lost data|duplicate (?:payments|charges|transactions)|wrong account|wrong tenant|wrong workspace|live payments?)\b", text):
        return escalate("Possible financial or data impact. Pause changes and route the case for investigation.")
    if re.search(r"\b(?:already tried|did not help|didn't help|after (?:retrying|restarting|reinstalling)|still fails after|same error after)\b", text):
        return escalate("A previous troubleshooting attempt may have failed. Route the case with the steps already tried.")
    products = sorted({source["product"] for source in library.values()})
    reported = facts.get("product", "")
    if reported:
        if UNKNOWN.search(reported):
            return escalate("The affected integration could not be identified.")
        matched_products = {source["product"] for source in library.values() if reported in source["aliases"]}
        if not matched_products:
            return escalate("There is no approved playbook for the reported integration.")
    else:
        matched_products = {source["product"] for source in library.values() if any(text_has(text, alias) for alias in source["aliases"])}
    if len(matched_products) != 1:
        options = sorted(matched_products) if matched_products else products
        return clarify("product", options[:8] + ["I can’t identify the service"], turns)
    product = next(iter(matched_products))
    scoped = [source for source in library.values() if source["product"] == product]
    symptom = facts.get("conflict") or facts.get("symptom") or initial
    if UNKNOWN.search(symptom):
        return escalate("The exact error or status could not be confirmed.")
    # Treat denials of a symptom as unconfirmed evidence.
    negated = re.search(r"\b(?:no (?:redirect|approval|low disk)|not (?:a redirect|expired|return a redirect)|never redirected|wasn't expired)\b", symptom)
    candidates = [source for source in scoped if matches(source, symptom) and not negated]
    if not candidates and symptom != initial and not negated:
        # Follow-up can supply a code while the original note holds the component context.
        candidates = [source for source in scoped if source["context"] and re.search(source["context"], initial, re.S)
                      and any(re.search(signal, symptom) for signal in source["signals"])]
    if len(candidates) == 1:
        return suggestion(candidates[0])
    if len(candidates) > 1:
        return clarify("conflict", [source["code"] for source in candidates] + ["I can’t verify the current error"], turns)
    return dict(clarify("symptom", [], turns), product=product, rag_eligible=not negated)


def keyword_baseline(ticket):
    matches_by_keyword = retrieve(ticket)
    if not matches_by_keyword:
        return escalate("No keyword match.")
    result = suggestion(matches_by_keyword[0], "Keyword")
    return dict(result, reason="Top keyword match. The rep must verify applicability.")


def checklist_baseline(ticket):
    """Representative first-pass triage with common red flags and an exact-code lookup."""
    text = ticket.lower()
    if re.search(r"\b(?:duplicate (?:charges|payments|transactions)|data loss|lost data|wrong account)\b", text):
        return escalate("The setup checklist sends possible data impact to a specialist.")
    checks = (("stripe-redirect", "stripe", r"\b302\b"),
              ("stripe-server", "stripe", r"\b500\b"),
              ("slack-approval", "slack", r"\b(?:approval required|pending approval)\b"),
              ("drive-disk", "google drive", r"\blow disk space\b"),
              ("drive-access", "google drive", r"\bpermissions to sync\b"),
              ("shopify-link", "shopify", r"\bexpired\b"),
              ("shopify-email", "shopify", r"\bemail verification\b"))
    for route, product, pattern in checks:
        if text_has(text, product) and re.search(pattern, text):
            return suggestion(SOURCES[route], "Checklist")
    return outcome("escalate", "Run first-pass setup checks", "No checklist shortcut matched. Capture the basics and route for review.",
                   "review", steps=["Confirm the affected service and the connection status.",
                   "Record the exact message and the last known successful sync.",
                   "Route the case to the integration owner if the issue remains."],
                   queue="Integration support specialist", mode="Checklist")
