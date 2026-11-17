# Syncdesk

Syncdesk is a vendor-neutral support copilot for integration setup and sync issues. It uses reviewed vendor playbooks to suggest next steps, request missing information, or prepare a handoff for a person.

## Run the prototype

Python 3.9+ is required. There are no package dependencies.

```bash
python3 -B app.py
```

Open <http://127.0.0.1:8765/>. On macOS, you can also open Terminal, run `cd` into this folder, and run `./Start-Syncdesk.command`. If the default port is occupied, start `python3 -B app.py --port 8766` and open the printed URL.

Select **How to use** at the top of the workspace for a walkthrough. **Try the Stripe example** opens a sample diagnosis with its supporting evidence.

1. Describe a fictional setup issue or open an example from the workspace.
2. Review the recommended procedure and evidence. For an incomplete report, answer the follow-up or queue it for human review.
3. Open Keyword search or Checklist to try a baseline. Use **Time this workflow** and finish after selecting a next step.
4. Open **Knowledge base → Add playbook** to add a service name, exact error phrase or code, support passage, reference URL, reviewed procedure, and optional handoff owner. Then submit a ticket containing that service name and phrase.
5. Open **Evaluation lab** to rerun the replay and inspect individual failures.

The bundled library covers Stripe, Slack, Google Drive, and Shopify. Custom tickets, playbooks, timed trials, and handoffs are stored in the current browser. A handoff creates a copyable packet in a local queue. Syncdesk does not send a notification or change a connected account.

## Run with a local LLM

1. Install [Ollama](https://ollama.com/download) and start it. For the command-line server, use `OLLAMA_NO_CLOUD=1 ollama serve`.
2. Download the approximately 1 GB [Qwen 2.5 1.5B model](https://ollama.com/library/qwen2.5:1.5b) with `ollama pull qwen2.5:1.5b`.
3. Run `python3 -B app.py`, open the workspace, and select **Webhook delivery fails**. Look for **Model diagnosis** and **Generated locally with qwen2.5:1.5b**.

Python retrieves passages from the reviewed playbook library and sends the selected passages and fictional ticket to Ollama on `127.0.0.1:11434`. The local model generates a diagnosis with a quote from the ticket and a quote from a retrieved source. Python checks the source ID and both quotes before displaying the diagnosis. The checked passage and its original link appear in the evidence pane.

Rules control procedural steps, financial-risk decisions, conflicting reports, and handoff ownership. When the model finds a possible match without a rules-verified route, it shows the cited hypothesis for human review. If Ollama is unavailable or generation fails validation, the rules workflow remains available. Citation checks validate the excerpts and source identity. A person still reviews the meaning of the generated text.

Inference runs on your computer after download. No hosted API key or per-call fee. Toggle **Use local LLM** in a diagnosis to compare with rules mode. Optionally set `SYNCDESK_MODEL` to the exact tag of another installed local model. Set `SYNCDESK_OLLAMA_PORT` if you configured Ollama to use a different local port.

## Reproduce the evaluation

```bash
python3 -B evaluate.py --write         # Rules, keyword search, and checklist
python3 -B evaluate.py --rag --write   # Add live local RAG results
python3 -B -m unittest -v
```

- [Product requirements and launch gates](reports/PRD.md)
- [Pilot case study and failure breakdown](reports/Pilot-Case-Study.md)
- [Per-ticket results](reports/ticket-results.csv)
- [Machine-readable results](reports/results.json)

The [live local RAG replay](reports/local-rag-results.json) recorded 29 of 30 correct routes and 20 model-generated diagnoses with validated quotes. The same rules-only replay also scored 29 of 30. See the [pilot case study](reports/Pilot-Case-Study.md#local-rag-replay) for the timing and evidence limits.
