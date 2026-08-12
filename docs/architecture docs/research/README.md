# Architecture research

Forward-looking research artefacts that aren't yet ADRs and aren't subsystem documentation. Use this directory for write-ups that exist to seed future decisions: pain catalogues, evaluation rubrics, candidate-comparison matrices, exploratory design notes the team hasn't ratified.

Treat each doc here as durable but not authoritative. If a research artefact graduates to an architectural decision, write an ADR under [`../adrs/`](../adrs/) and either retire the research doc or leave it in place as the rationale trail.

## Contents

- [`commander-friction-points.md`](commander-friction-points.md) — catalogue of the concrete places `@internal/cli` works around CommanderJS today, plus a 10-point evaluation rubric for scoping a future Commander replacement. Written during TML-2318 (the migration-file CLI parser swap to clipanion), where Commander's friction came up but a wholesale CLI-library replacement was out of scope.
