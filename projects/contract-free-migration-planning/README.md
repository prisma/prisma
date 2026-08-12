# contract-free migration planning

Make the migration planner a pure function of two schema IRs — `plan(start, end)` with no contract. Completes the one-differ thesis from the postgres-rls substrate ([ADR 235](../../docs/architecture%20docs/adrs/ADR%20235%20-%20The%20schema%20differ%20walks%20two%20derived%20schema%20IRs.md)).

- [`spec.md`](./spec.md) — project intent, locked decisions, DoD (source of truth for shape).
- `plan.md` — slice sequencing (next).
- **Linear:** [TML-3026](https://linear.app/prisma-company/issue/TML-3026) · **Branch:** `tml-3026-contract-free-migration-planning`

Three strands: dependency-ordered planning (a graph replaces the integer `nodeIssueOrder` table) · codec-contributed ops ride the differ (extensions/custom types become diff nodes) · extensions and custom types become authored entities.

Transient project artifact — deletes at close-out; durable decisions land as ADRs and the migration-system subsystem doc.
