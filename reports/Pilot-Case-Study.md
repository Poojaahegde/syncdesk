# Syncdesk pilot case study

**Status:** Working prototype and fictional ticket replay. A pilot with support reps remains unmeasured. The rules baseline below predates the local RAG evaluation.

## What we tested

Seven curated playbooks cover specific setup and sync symptoms across four providers. The test set has 30 fictional cases distinct from the inbox examples, including ambiguous services, missing evidence, stale symptoms, and potential financial impact. Labels define the expected disposition and specific procedure or handoff owner. This is a small demonstration holdout authored for the prototype. External reviewers have not validated the cases or labels.

- **Copilot** uses the local policy and receives scripted answers only when it asks for the corresponding detail.
- **Keyword search** uses the top result from the same library on the initial ticket. A live rep could refine the query or reject a suggestion.
- **Setup checklist** uses representative first-pass checks and common exact phrases from the initial ticket. It is a comparison baseline built for this demo. A live rep could use the checklist to collect more information.

The replay compares workflow policies. Interactive clarification gives the copilot access to additional facts on some tickets, so this is not an equal-input comparison of classifier accuracy.

## Results

| Measure | Copilot | Keyword search | Setup checklist |
|---|---:|---:|---:|
| Exact route and disposition | 29/30 | 20/30 | 14/30 |
| Correct procedure on resolvable cases | 10/11 | 10/11 | 2/11 |
| Tickets with unsupported procedure | 0/30 | 10/30 | 1/30 |
| Escalation accuracy | 29/30 | 24/30 | 20/30 |
| Escalation precision | 19/20 | 14/15 | 18/27 |
| Escalation recall | 19/19 | 14/19 | 18/19 |
| Median rep handling time | Awaiting pilot | Awaiting pilot | Awaiting pilot |

A resolution means the replay selected the labeled procedure. No account changes were made. Unsupported procedure means cited steps were applied to the wrong route. An unrelated or wrong cited procedure is a failure even when the article itself is authentic. The evaluator measures local processing latency separately and exports each ticket’s result.

## Failure breakdown and product decision

- **E21, storage paraphrase.** The report said the device’s capacity was exhausted. The local matcher asked for the exact error. With none available, it safely routed to a person instead of recommending the Drive local-storage procedure. This produced the only local replay miss and the only unnecessary escalation.
- **Keyword search.** It selected the right procedure just as often on resolvable cases. Its larger weakness was applying sources to ambiguous or risky cases without checking whether the evidence identified the right procedure.
- **Checklist.** It conservatively routed more cases to review but rarely recovered the specific procedure from a paraphrase. It also lacked a conflict check where the same report contained different error codes.

**Decision:** Keep the case in the regression set. Gather fresh examples of storage-related reports, including account quota versus local disk warnings. Have a reviewer label a separate evaluation set before expanding the matcher or using a model to suggest a source.

## Human pilot plan

Recruit 5–8 support reps. Each uses all three workflows on matched fictional cases, with order rotated. Start timing as a ticket is revealed. Stop after the rep records a resolution or handoff and its rationale. An independent reviewer scores the decision, source relevance, and unsupported claims. Report median duration, count per workflow, and accuracy by provider. Interview reps about needless questions, hard-to-find evidence, and handoff detail. Use the app's timer as instrumentation and exclude QA clicks from the pilot data.

## Local RAG replay

A second run used Qwen 2.5 1.5B through Ollama on an Apple Silicon Mac, with the same 30 fictional tickets and scripted follow-up answers.

| Metric | Rules | Local RAG workflow |
|---|---:|---:|
| Exact route and disposition | 29/30 | 29/30 |
| Correct procedure on resolvable cases | 10/11 | 10/11 |
| Escalation recall | 19/19 | 19/19 |
| Tickets with an inapplicable recommended procedure | 0/30 | 0/30 |
| Median replay processing time | 0.034 ms | 687 ms |

The model produced a diagnosis with validated quotes on 20 tickets. Rules handled nine final decisions directly, and the rules result was used on one when the model output was rejected. The storage paraphrase in E21 still led to a handoff. E04 used the correct rules route after the local model did not produce a usable diagnosis.

This run shows the model can explain many matched cases with citations. It does not demonstrate a routing accuracy improvement on this set. The procedure metric scores route applicability. It does not establish the truth of each generated claim. Before a wider pilot, have independent reviewers grade the generated diagnoses for factual support and usefulness, and repeat on a larger test set. End-to-end rep handling time still requires the human pilot.

[Detailed local RAG results](local-rag-results.json) · [Per-ticket CSV](local-rag-ticket-results.csv)
