---
changes:
  - id: family-codec-templates-render-no-literals
    summary: |
      `postgresCodec` and `sqliteCodec` now throw an `InternalError` when the family codec template they adapt declares `renderValueLiteral`. Earlier versions copied the template's renderer. A family template renders no literal, because only the target knows the form its data type stores a value in. Remove `renderValueLiteral` from the template and pass it in the adapter's options instead; the framework exports `renderTsLiteral`, `floatNumberLiteral`, `decimalTextNumberLiteral` and `decimalTextBigintLiteral` from `@internal/framework-components/codec` for the common stored forms.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - '(?<![\s\S])(?=[\s\S]*\bextends\s+CodecDescriptorTemplateImpl\b)(?=[\s\S]*\brenderValueLiteral\s*\()'
---

## `family-codec-templates-render-no-literals`

```ts
// before: the template renders, and postgresCodec copied it
export class MyTextTemplate extends CodecDescriptorTemplateImpl<void> {
  override renderValueLiteral(value: JsonValue): string | undefined {
    return renderTsLiteral(value);
  }
  // ...
}
export const myTextDescriptor = postgresCodec(myTextTemplate, {
  dataType: pgText,
  jsonProjection: (expression) => expression,
  factory: (descriptor, dataType) => () => new MyTextCodec(descriptor, dataType),
});

// after: the template renders nothing, and the target passes the renderer
export class MyTextTemplate extends CodecDescriptorTemplateImpl<void> {
  // ...
}
export const myTextDescriptor = postgresCodec(myTextTemplate, {
  dataType: pgText,
  renderValueLiteral: renderTsLiteral,
  jsonProjection: (expression) => expression,
  factory: (descriptor, dataType) => () => new MyTextCodec(descriptor, dataType),
});
```

Without the option, the adapted codec renders no literal, so an enum or value set on it is typed as the codec's whole output type.
