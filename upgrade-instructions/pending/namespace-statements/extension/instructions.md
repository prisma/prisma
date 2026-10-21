---
changes:
  - id: statement-planning-target-namespaces
    summary: |
      In `@prisma/orm-family-sql/family/control`, `StatementPlanningTarget` gains `createNamespaceCalls(namespaceId)`, `moveTableCall(move)`, `namespaceRenameRefusal(rename)` and `renameNamespaceCall(rename)`, and `SchemaTables` gains `hasNamespace(namespaceId)`. A target or a test double that implements either adds them.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '(?<![\w$])(?:StatementPlanningTarget|SchemaTables)(?![\w$])'
  - id: schema-ownership-namespace-spaces
    summary: |
      `SchemaOwnership` from `@prisma/orm-framework/components/control` gains `namespaceDeclaringSpaces(namespaceId)`: the ids of the contract spaces that declare the namespace. A test double of it adds the method.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '(?<![\w$])SchemaOwnership(?![\w$])'
  - id: namespace-rename-statement
    summary: |
      `ResolvedRenameStatement` from `@prisma/orm-framework/components/control` gains `ResolvedNamespaceRenameStatement`, `{ kind: 'rename', entity: 'namespace', from, to }`, whose `from` and `to` are namespace ids. Code that switches over a rename's `entity` handles `'namespace'`.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '(?<![\w$])ResolvedRenameStatement(?![\w$])'
---

# Statements can move tables and rename namespaces

## `statement-planning-target-namespaces`

A SQL target's statement planner now moves a table to another namespace and renames a namespace. Add the four methods to each `StatementPlanningTarget` you implement, and `hasNamespace` to each `SchemaTables`:

```ts
createNamespaceCalls: (namespaceId) => [],
moveTableCall: (move) => { throw new InternalError(`no namespace move for ${move.table}`); },
namespaceRenameRefusal: (rename) => undefined,
renameNamespaceCall: (rename) => { throw new InternalError(`no namespace rename for ${rename.from}`); },
hasNamespace: (namespaceId) => namespaceId === UNBOUND_NAMESPACE_ID,
```

A target with one namespace, as SQLite has, never reaches `moveTableCall` or `renameNamespaceCall`, since no statement resolves to a move or a namespace rename there. A target with several namespaces returns the calls that create a namespace, move a table and rename a namespace, and applies them to its working schema. `namespaceRenameRefusal` returns `{ reason, fix }` for a namespace it cannot rename.

## `schema-ownership-namespace-spaces`

Add `namespaceDeclaringSpaces: () => []` to a `SchemaOwnership` test double that declares no namespace, or return the ids of the spaces whose contracts have the namespace in `storage.namespaces`.

## `namespace-rename-statement`

A `switch` or `if` over `statement.entity` of a `ResolvedRenameStatement` gains a `'namespace'` branch. A planner that cannot rename a namespace refuses the statement with a `statementRefused` conflict.
