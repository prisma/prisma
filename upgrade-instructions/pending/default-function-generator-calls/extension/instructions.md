---
changes:
  - id: default-functions-declare-generator-calls
    summary: |
      A default function an extension registers in `controlMutationDefaults.defaultFunctionRegistry` can now declare `generatorCalls`: for each generator id the function lowers to, a function that writes the PSL call from the generator's params. `contract print` writes a generated value only through such a call, so add `generatorCalls` to each entry that lowers to an execution generator. Two entries in one stack that declare a call for the same generator id now fail when the stack is composed. The detection matches a file that registers a default function.
    detection:
      glob: "**/*.{ts,mts,cts}"
      matches:
        - 'defaultFunctionRegistry\s*:'
---

# Declare the PSL call of each generator a default function produces

`contract print` writes a column with a generated value as the `@default(...)` call of a default function in the configured stack. It finds that call through the new optional `generatorCalls` field of `ControlMutationDefaultEntry`. A function without it still reads PSL as before, but `contract print` refuses a contract that uses one of its generators with `CONTRACT.PRINT_UNSUPPORTED` ("there is no default function in the configured stack that writes it").

For each entry whose `lower` returns `{ kind: 'execution', generated: { kind: 'generator', id } }`, add one key per generator id it can return. The value receives the generator's `params` from the contract and returns the call text that lowers back to the same generator and params:

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
  generatorCalls: { slugid: () => 'slugid()' },
};
```

When the call takes arguments that become params, write them back from `params`:

```ts
generatorCalls: {
  myId: (params) => (typeof params?.['size'] === 'number' ? `myId(${params['size']})` : 'myId()'),
},
```

An entry that lowers only to a database default, such as `now()`, needs no `generatorCalls`.

A generator id may have a call in only one entry of the composed stack. If your function and another pack's both declare a call for the same id, composing the stack fails with `Duplicate PSL call for mutation default generator "<id>"`; give your generator its own id.
