---
from: "0.17"
to: "0.18"
changes:
  - id: rendered-ts-literals-are-double-quoted
    summary: |
      `renderTsLiteral` (`@internal/framework-components/codec`) now returns a double-quoted
      TypeScript literal — `"low"` where it used to return `'low'`. It delegates to a single
      shared renderer (`JSON.stringify` plus an explicit U+2028/U+2029 escape), which also
      closes escaping gaps the old implementation had: `\t`, `\v`, `\b`, `\f` and the remaining
      C0 control characters were previously emitted raw. Calling code needs no change, and the
      emitted `contract.d.ts` is byte-identical either way because `contract emit` formats with
      prettier at `singleQuote: true`. What does change is any assertion your pack makes on the
      *unformatted* return value — a codec unit test pinning `renderValueLiteral` output, or a
      test that calls `generateContractDts` directly and greps the result. Update those
      expectations to the double-quoted form. If your pack hand-rolls a `renderValueLiteral`
      that builds its own quoted literal, it keeps working, but switch it to `renderTsLiteral`
      so your pack's escaping matches the framework's.
    detection:
      glob: "**/*.{test,test-d}.ts"
      contains:
        - 'renderValueLiteral'
        - 'generateContractDts'
      anyMatch: true
---

## Rendered TypeScript literals are double-quoted

The framework had three separate implementations of "escape this string for a TypeScript
literal", each with a different idea of what needed escaping. They are now one function, and the
one that survived is the `JSON.stringify`-based renderer.

For an extension pack, the practical surface is `renderTsLiteral`, which most custom codecs use
to implement `renderValueLiteral`:

```ts
// Before — renderTsLiteral returned a single-quoted literal
expect(codec.renderValueLiteral?.('low', 'output')).toBe("'low'");

// After
expect(codec.renderValueLiteral?.('low', 'output')).toBe('"low"');
```

Two things worth knowing when you update these:

- **The escaping inverted, it did not merely re-quote.** Under `JSON.stringify` a single quote is
  no longer escaped and a double quote is. So `renderTsLiteral("it's")` is `"it's"`, not
  `'it\'s'`. A mechanical quote swap over your test expectations will get the simple cases right
  and the escaping cases wrong — check any assertion whose input contains a quote by hand.

- **Values are unaffected; only the rendering is.** No contract hash changes, no re-emit is
  needed, and the artefacts your pack ships (`contract.json`, `contract.d.ts`, migrations) are
  unchanged. If your pack's committed contract artefacts do show a diff after upgrading, that is
  a different change in this transition, not this one.
