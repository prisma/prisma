---
changes:
  - id: enum-value-rename-statement
    summary: |
      `ResolvedRenameStatement` from `@prisma/orm-framework/components/control` gains `ResolvedEnumValueRenameStatement`, `{ kind: 'rename', entity: 'enumValue', from, to }`, whose sides are `EnumValueCoordinate`s (`namespaceId`, `enum`, `member`). `MigrationSubject` gains `{ kind: 'enumValue' }` with the same coordinate. Code that switches over a rename's `entity` or a subject's `kind` handles `'enumValue'`.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '(?<![\w$])(?:ResolvedRenameStatement|ResolvedMigrationStatement|MigrationSubject)(?![\w$])'
---

# Statements and subjects can name an enum value

## `enum-value-rename-statement`

`--rename Status.ARCHIVED:Status.RETIRED` resolves to a rename statement with `entity: 'enumValue'`, and a data-loss subject can be `{ kind: 'enumValue', namespaceId, enum, member }`, named by the member's name in the contract source. A `switch` or `if` over `statement.entity` or `subject.kind` gains an `'enumValue'` branch. A planner that does not plan enum value renames refuses the statement with a `statementRefused` conflict, as it refuses a namespace rename it cannot plan.
