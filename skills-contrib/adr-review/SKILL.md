---
name: adr-review
description: >-
  Review one or more ADRs with fresh eyes (as a team member without prior
  context), identify narrative and structural issues, then rewrite them. Use
  when the user asks to review, improve, rewrite, or take a fresh-eyes pass on
  an ADR or a set of ADRs (Architecture Decision Records).
---

# Reviewing and Rewriting ADRs

Read each ADR with fresh eyes. Pretend you're a member of the team who doesn't have all the context the author has. The goal is to find places where the document assumes context the reader doesn't have, buries the decision, or carries baggage that won't make sense to a future reader.

This skill applies whether you're working on a single ADR or a batch. Treat each ADR independently — do the analysis and rewrite per document — even when several are in scope at once.

## Workflow

1. **Analyze first, in chat.** Before touching any file, list the issues you found and explain them. Do not rewrite silently. When multiple ADRs are in scope, group your analysis per ADR so the user can react to each one before rewrites land.
2. **Then rewrite each document** to address the issues you identified.

## What a good ADR looks like

- **Starts with a clear grounding example.** Give the reader something concrete to pin understanding to before the abstract reasoning starts.
- **Has a strong narrative that builds the topic up bit by bit**, explaining clearly throughout. Don't compress; let ideas breathe.
- **Leads with the decision.** State what's being decided up front. The reader should know the conclusion before working through the reasoning.
- **Ends with alternatives considered.** Put rejected options last so the reader isn't loaded down with information about paths the document is making irrelevant.

## What an ADR must NOT contain

ADRs are long-lived documentation. They should not contain:

- References to Linear tickets, GitHub issues, or other ticket trackers.
- Milestones from the project that produced the ADR.
- States the system passed through during or preceding a refactor that will never be seen again — interim names, deprecated wrappers being removed, "current" qualifiers, "we used to" framing.

If a piece of context only makes sense to someone who lived through the change, cut it or rewrite it as a fact about the system as it is.

## Output shape

When invoked:

1. Read the ADR (or ADRs) in scope.
2. Write your analysis in the chat — what's missing, what's buried, what's transient, what's unclear to a fresh reader. Be specific; quote or cite the parts you're flagging. For multiple ADRs, label each block clearly.
3. Then rewrite each file end-to-end so it follows the structure above.
