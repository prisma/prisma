# Drive trial — findings

> **Trial window:** 2026-05-19 → 2026-06-02. See [`drive/trial.md`](../trial.md) for the quality bar, tags, and format. Record only what meets the bar — `friction`, `gap`, `win`, `surprise`, `boundary`. One stanza per finding.

## 2026-05-20 · drive-triage-work · gap

Triage didn't distinguish a problem statement ("agent is leaving workflow too easily") from a settled design ("make Orchestrator a structural role with file-path check"). Default verdict routed straight to slice without recognising design discussion was missing. Caught mid-flow by the operator surfacing the missing-discussion gap; corrected by adding the *problem-statement-vs-design* heuristic to `drive/triage/README.md § Triage heuristics`.

**Suggested action:** the heuristic is now landed; observe whether subsequent triage calls catch the same shape without further reinforcement. If repeated, promote heuristic to canonical via `drive-update-skills`.

**Upstream candidate?** Maybe — repeat the failure shape once more on a different domain before upstreaming, to confirm it generalises beyond Drive-skills introspective work.

## 2026-05-20 · drive-triage-work · friction

Slice-level decomposition initially produced 5 slices for what (per the 1:1:1 rule) belonged in 1 PR — 5 Linear tickets filed upfront. Operator corrected with the *Slice ≡ PR ≡ Linear ticket* rule and the *design depth ≠ slice count* heuristic; both landed in `docs/drive/principles/decomposition-and-cost.md § sizing-stack` and `drive/triage/README.md § Triage heuristics`. Cleanup: 4 tickets cancelled, branch renamed once.

**Suggested action:** landed. Track whether subsequent triage holds the 1:1:1 line cleanly; if drift recurs, tighten the heuristic with a worked example in the team's calibration overlay.

**Upstream candidate?** Yes — the 1:1:1 rule and the depth-vs-count split apply to any team running Drive.
