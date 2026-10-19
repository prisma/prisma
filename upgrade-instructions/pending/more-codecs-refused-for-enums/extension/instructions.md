---
changes:
  - id: adapted-family-codecs-render-literals-from-target-options
    summary: |
      `postgresCodec` and `sqliteCodec` no longer copy `renderValueLiteral` from the family codec template they adapt. A family template renders no literal, because only the target knows the form its data type stores a value in. Pass the renderer in the options instead, as `renderValueLiteral`; the framework exports `renderTsLiteral`, `floatNumberLiteral`, `decimalTextNumberLiteral` and `decimalTextBigintLiteral` from `@internal/framework-components/codec` for the common stored forms.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '\b(?:postgresCodec|sqliteCodec)\('
---

## `adapted-family-codecs-render-literals-from-target-options`

```ts
// before: the template's renderValueLiteral was used
export const myTextDescriptor = postgresCodec(myTextTemplate, {
  dataType: pgText,
  jsonProjection: (expression) => expression,
  factory: (descriptor, dataType) => () => new MyTextCodec(descriptor, dataType),
});

// after: the target passes it
export const myTextDescriptor = postgresCodec(myTextTemplate, {
  dataType: pgText,
  renderValueLiteral: renderTsLiteral,
  jsonProjection: (expression) => expression,
  factory: (descriptor, dataType) => () => new MyTextCodec(descriptor, dataType),
});
```

Without the option, the adapted codec renders no literal, so an enum or value set on it is typed as the codec's whole output type.
