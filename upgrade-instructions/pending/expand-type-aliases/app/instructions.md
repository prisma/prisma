---
changes:
  - id: stored-contracts-expand-type-aliases
    summary: |
      A stored SQL contract whose columns name a type alias in `typeRef` no longer loads. Run `scripts/expand-type-aliases/expand-type-aliases.ts` from the project root, then re-emit the contract, then run `prisma db sign` against every database.
    detection:
      glob: "**/contract.json"
      matches:
        - '"typeRef"\s*:'
    script: scripts/expand-type-aliases/expand-type-aliases.ts
---

# Type aliases are written into each column
