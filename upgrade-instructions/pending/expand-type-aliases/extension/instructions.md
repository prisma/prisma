---
changes:
  - id: stored-contracts-expand-type-aliases
    summary: |
      A stored SQL contract whose columns name a type alias in `typeRef` no longer loads. Run `scripts/expand-type-aliases/expand-type-aliases.ts` from the extension's package root, then re-emit the bundled contract.
    detection:
      glob: "**/contract.json"
      matches:
        - '"typeRef"\s*:'
    script: scripts/expand-type-aliases/expand-type-aliases.ts
---

# Type aliases are written into each column
