# Codec JSON projections

Transient project workspace for [Codec JSON projections](https://linear.app/prisma-company/project/codec-json-projections-a10fba2e9cd5), tracked by [TML-3060](https://linear.app/prisma-company/issue/TML-3060/plan-codec-json-projections). See [`spec.md`](./spec.md) for the system-level contract, [`design-notes.md`](./design-notes.md) for the settled design and rejected alternatives, and [`plan.md`](./plan.md) for the four-PR stack.

Branch: `tml-3060-codec-json-projections`.

The exact pre-project PostgreSQL numeric prototype is preserved under [`assets/`](./assets/), including its original uncommitted diff and integrity hash. Its regression tests and database evidence remain inputs to later slices, but its codec-ID-hardcoded renderer and derived-table lineage inference are not the selected architecture.

> Everything under `projects/` is transient — migrate long-lived architecture and upgrade documentation to `docs/`, remove repo-wide references to this workspace, and delete it at project close-out per [`projects/README.md`](../README.md).
