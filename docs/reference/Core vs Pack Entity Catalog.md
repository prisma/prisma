# Core vs Pack Entity Catalog

Purpose: quick reference of which features live in core vs are provided by packs.

- Feature table:
  - Columns: feature, in core, capability keys, contract shape location, relevant ADRs


| Feature                 | In core | Capability keys         | Contract shape location             | ADRs         |
| ----------------------- | ------- | ----------------------- | ----------------------------------- | ------------ |
| Tables/Columns/PK/UK/FK | Yes     | n/a                     | `tables.*`                          | ADR 005, 010 |
| Basic indexes           | Yes     | n/a                     | `tables.*.indexes[]`                | ADR 005, 010 |
| ForeignKey metadata     | Yes     | n/a                     | `tables.*.foreignKeys[]`            | ADR 005      |
| Logical enums           | Yes     | n/a                     | `enums[]`, `columns[].type.logical` | ADR 121      |
| Namespaces (RelationId) | Yes     | n/a                     | `tables.*.id = { namespace, name }` | ADR 121      |
| Partial index predicate | Pack    | `index.partial`         | `indexes[].ext.<ns>`                | ADR 065, 116 |
| DISTINCT ON             | Pack    | `projection.distinctOn` | Query feature, gated                | ADR 065      |
| Distribution/shard keys | Pack    | `distribution.shardKey` | `tables.*.ext.<ns>`                 | ADR 065, 116 |
| View/materialization    | Pack    | `view.materialized`     | `views[].ext.<ns>` or pack-managed  | ADR 116      |
| Geospatial types/op     | Pack    | `postgis.*`             | `columns[].ext.postgis`             | ADR 112–115  |
| Vector types/op         | Pack    | `pgvector.*`            | `columns[].ext.pgvector`            | ADR 112–115  |


Notes

- Capability keys are canonical per ADR 065/117; packs own namespaced keys.
- Core never interprets unknown `ext` namespaces but preserves them deterministically.

