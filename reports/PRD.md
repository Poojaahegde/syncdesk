# Syncdesk product requirements

## Problem

A support rep receives an integration issue with an incomplete description. Searching product docs can find a plausible article for the wrong service, symptom, or ownership boundary. A generic checklist can leave the rep repeating questions or escalating a case with little context.

**Primary user:** Frontline support rep handling setup or sync tickets across multiple providers.

**Job:** Decide whether to apply a documented, low-risk next step, request one missing fact, or route to an accountable human. Attach enough context that the next owner can act.

**Discovery status:** The workflow is a hypothesis informed by public vendor troubleshooting docs. No rep interviews have been conducted. In discovery, observe reps on three recent cases each and validate where time goes, which actions require admin approval, and what a useful handoff contains.

## Requirements

| Requirement | Acceptance criterion |
|---|---|
| Vendor-neutral intake | A rep can enter a fictional ticket for any service. Built-in examples demonstrate Stripe, Slack, Google Drive, and Shopify. A reviewed custom playbook requires no code change. |
| Evidence-backed recommendation | An applicable route shows the source, passage, and curated steps. Provider and reported symptom must agree. The source and copied steps travel together. |
| Clarify or abstain | When provider, current error, or policy context is ambiguous, ask a targeted question. If the answer remains unclear, prepare a handoff. |
| Human ownership and support safety | Possible financial/data impact goes to a specialist. Vendor-specific owner routes preserve the correct owner. Handoff includes the original ticket, reason, confirmed details, and citation when available. Changes in connected systems require a human. |
| Compare workflows | The rep can search the same documented procedures and use a representative first-pass checklist. The evaluation exposes metric denominators and per-case failures. |
| Measure handling time | Browser timers record a rep's time to choose a next action. Report medians and sample sizes by workflow. Keep automated processing latency separate. |

## Product decisions

- The offline path uses explicit provider and symptom rules and vetted steps. It is fast and predictable, with a higher chance of handoff on unusual phrasing.
- A local model generates a cited diagnosis from retrieved evidence. Reviewed steps and ownership stay controlled by the rules. A model-only match is shown as a hypothesis for review. This separates model fluency from the decision to recommend an action.
- Start with small, auditable playbooks. A reviewer owns each source and its scope. The demo supports user-supplied passages and does not fetch arbitrary pages.

## Metrics and launch gates

**Primary outcome:** Median time from opening a ticket to recording a correct next action. Count reroutes and follow-ups as part of the task. Report correct resolution, unsupported guidance, escalation precision/recall, and provider-level slices.

| Stage | Proposed gate and decision |
|---|---|
| Local demo | Working diagnosis, clarification, safe handoff, and extensible playbooks. Verify all fixtures linked to a real procedure where supported. |
| Shadow pilot | Independently labeled cases from all covered providers. Require ≥90% correct resolution among resolvable cases, ≥95% escalation recall, and zero severe unsupported recommendations in the reviewed sample. Record the denominator and review every miss. |
| Assisted pilot | Invite 5–8 consenting reps. Use equivalent randomized tasks by workflow. Target ≥20% lower median time to a correct next action and no decline in routing quality. Reps approve all outbound guidance. |
| Rollback | If guidance risks financial/data harm or bypasses the documented ownership boundary, disable the affected playbook and route to manual review. Withdraw a stale source pending verification. |

For a production build, add authenticated team-level access, source ownership and review dates, audit logs, a formal sensitive-data policy, and a ticketing integration.
