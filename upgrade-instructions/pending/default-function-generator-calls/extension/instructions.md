---
changes:
  - id: default-functions-declare-generator-calls
    summary: |
      A default function an extension registers in `controlMutationDefaults.defaultFunctionRegistry` can now declare `liftArguments`, the reverse of `lower`: for each generator id the function lowers to, a function that writes the arguments of the PSL call from the generator's params. `contract print` writes a generated value only through it, so add `liftArguments` to each entry that lowers to an execution generator. Composing a stack now fails when two entries lift the same generator id, or when an entry lifts a generator id no generator descriptor in the stack registers. The detection matches a file that registers a default function.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - 'defaultFunctionRegistry\s*:'
  - id: field-presets-declare-lift
    summary: |
      A field preset whose option arguments select a generator can now declare `lift`: the codec it writes, the column type params its leading positional arguments write, and for each phase the argument, value and generator id. `contract print` writes a generated value through such a preset only when it declares `lift`. `temporalCodecPreset` and `temporalCodecPresetWithPrecision` set it for you. Composing a stack now fails when a lift does not match the preset's output, or when two presets lift the same codec with the same generator. The detection matches a file that declares a field preset.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - "kind:\\s*'fieldPreset'"
---

# Declare how `contract print` writes your generated values

## Default functions: `liftArguments`

`contract print` writes a column with a generated value as the `@default(...)` call of a default function in the configured stack. It finds that call through the new optional `liftArguments` field of `ControlMutationDefaultEntry`, the reverse of `lower`. A function without it still reads PSL as before, but `contract print` refuses a contract that uses one of its generators with `CONTRACT.PRINT_UNSUPPORTED` ("there is no default function in the configured stack that writes it").

For each entry whose `lower` returns `{ kind: 'execution', generated: { kind: 'generator', id } }`, add one key per generator id it can return. The value receives the generator's `params` from the contract and returns the text between the call's parentheses. The printer writes `<function name>(<arguments>)`, with the name the entry is registered under:

```ts
// Before
const slugidEntry: ControlMutationDefaultEntry = {
  signature: { documentation: 'Generates a slug identifier when a field value is omitted.' },
  lower: () => ({
    ok: true,
    value: { kind: 'execution', generated: { kind: 'generator', id: 'slugid' } },
  }),
  usageSignatures: ['slugid()'],
};

// After
const slugidEntry: ControlMutationDefaultEntry = {
  signature: { documentation: 'Generates a slug identifier when a field value is omitted.' },
  lower: () => ({
    ok: true,
    value: { kind: 'execution', generated: { kind: 'generator', id: 'slugid' } },
  }),
  usageSignatures: ['slugid()'],
  liftArguments: { slugid: () => '' },
};
```

When the call takes arguments that become params, write them back from `params`, so the call lowers back to the same generator and params:

```ts
liftArguments: {
  myId: (params) => (typeof params?.['size'] === 'number' ? String(params['size']) : ''),
},
```

An entry that lowers only to a database default, such as `now()`, needs no `liftArguments`.

Each key must be a generator id that a generator descriptor in the composed stack registers (`controlMutationDefaults.generatorDescriptors`), and only one entry in the stack may lift it. Otherwise composing the stack fails with `Duplicate PSL call for mutation default generator "<id>"` or `... writes a PSL call for generator "<id>", which no generator descriptor in the stack registers.`

## Field presets: `lift`

A preset whose option argument selects a generator, such as `onCreate: now`, is written back by `contract print` only when it declares `lift`. A preset built with `temporalCodecPreset` or `temporalCodecPresetWithPrecision` already has it. A preset you write by hand adds it next to `output`:

```ts
const stamped: AuthoringFieldPresetDescriptor = {
  kind: 'fieldPreset',
  args: [
    { name: 'precision', kind: 'number', optional: true, integer: true },
    { name: 'onCreate', kind: 'option', values: ['now'], optional: true },
  ],
  output: {
    codecId: 'pg/timestamptz-temporal@1',
    typeParams: { precision: { kind: 'arg', index: 0 } },
    executionDefaults: {
      onCreate: { kind: 'select', index: 1, cases: { now: { kind: 'generator', id: 'clusterNow' } } },
    },
  },
  lift: {
    codecId: 'pg/timestamptz-temporal@1',
    typeParams: ['precision'],
    onCreate: { argument: 'onCreate', value: 'now', generatorId: 'clusterNow' },
  },
};
```

The lift must agree with the output: the same codec, and each phase argument must select the named generator with the named value. Only one preset in the stack may lift a codec with a generator. Composing the stack refuses either mistake with `CONTRACT.PACK_CONTRIBUTION_INVALID`.
