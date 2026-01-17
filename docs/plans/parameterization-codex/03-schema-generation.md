# ParamGraph Generation from DMMF

This document describes how to compile DMMF into ParamGraph at client
generation time. The output must be plain JSON so it can be embedded in the
client bundle.

## Inputs

- `dmmf.schema.inputObjectTypes` (input types and their fields)
- `dmmf.schema.outputObjectTypes` (output types and their fields)
- `dmmf.mappings` (model operations and root field names)
- `dmmf.datamodel.enums` or `dmmf.schema.enumTypes.model` (user enums)

## ParamGraphBuilder

Use a `ParamGraphBuilder` helper in the generators to keep code readable while
writing directly into the compact `ParamGraph` shape. The builder should:

- intern field names into `graph.s`
- allocate input/output nodes in `graph.i` / `graph.o`
- cache union nodes by a stable key (sorted fully-qualified type names)
- record roots in `graph.r`
- record enum names in `graph.en`

This avoids a separate `pack()` step while still hiding one-letter field names
from the generator logic.

## Step 0: Action Name Mapping

Json protocol actions differ from DMMF ModelAction for a few write operations:

```
createOne  -> create
updateOne  -> update
deleteOne  -> delete
upsertOne  -> upsert
```

When building roots, emit keys using **JsonQueryAction** (runtime input) even if
DMMF uses the shorter names.

## Step 1: Enum Names

Build a table of user-defined enum **names** (values are looked up at runtime
via `runtimeDataModel.enums`):

```ts
const enumNames: string[] = [] // graph.en
const enumIdByName = new Map<string, number>()

for (const e of dmmf.datamodel.enums) {
  enumIdByName.set(e.name, enumNames.length)
  enumNames.push(e.name)
}
```

Only user-defined enums should appear here. Prisma enums (`QueryMode`,
`TransactionIsolationLevel`, `JsonNull`, etc.) are structural and are never
parameterized.

## Step 2: Input Nodes

Input nodes are built from **SchemaArg lists**, which appear in two places:

- DMMF input object types (`InputType.fields`)
- Output field args (`OutputType.fields[].args`)

Treat both as the same shape: an object with named fields and `inputTypes`.

### Field Analysis

For each `SchemaArg`:

1. Partition `inputTypes` by location:
   - `scalar`
   - `enumTypes`
   - `fieldRefTypes` (structural only)
   - `inputObjectTypes`

2. Compute flags:
   - `ParamScalar` if `isParameterizable` and scalar/enum types exist
   - `ListScalar` if any scalar/enum types are list
   - `ListObject` if any input object types are list
   - `Object` if any input object types exist
   - `Nullable` if `isNullable` is true

3. Compute scalar mask (`m`) based on scalar type names:
   - String, Int, Float, Boolean, DateTime, Decimal, BigInt, Bytes, Json

4. For enums:
   - If only enum types are present (no String scalar), attach `e` (enum name id)
   - If the enum is not user-defined (namespace `prisma`), do not allow
     parameterization

5. For input object types:
   - Build or reference a **union node** for all object type refs

### Union Node Strategy

If a field accepts multiple input object types, build a union node keyed by the
sorted list of fully-qualified type names. Merge their fields conservatively:

- For fields present in multiple variants, only enable parameterization if all
  variants agree. If they disagree, omit the field entirely (no parameterization
  and no recursion) and emit a debug log during generation.
- Child edges are unioned and point to the union of child types.

This avoids runtime branching and maintains correctness for ambiguous unions.

**Initial implementation note:** because placeholders are currently untyped,
union conflicts must disable parameterization at that field. A follow-up task
introduces typed placeholders to safely re-enable parameterization with merged
scalar masks (see `docs/plans/parameterization-codex/06-typed-placeholders-client.md`).

## Step 3: Output Nodes

Output nodes are used to traverse selection trees and reach nested `arguments`.
They are built from `schema.outputObjectTypes`.

For each output field:

- If `field.args` is non-empty, build an input node from that args list and set
  `OutputEdge.a`.
- If `field.outputType.location === 'outputObjectTypes'`, link to the child
  output node for that output type (if it leads to any parameterizable args).

Output nodes are pruned to only include fields that either:

- Have `arguments` that lead to parameterizable input nodes, or
- Lead to child output nodes that can reach parameterizable args.

## Step 4: Roots

For each mapping in `dmmf.mappings.modelOperations`:

1. Locate the root field in `Query` or `Mutation` by name.
2. Build an args node from the root field's `args` list.
3. Build an output node from the root field's output type.
4. Store in `graph.r` using the JsonQueryAction name.

For `otherOperations` (executeRaw, queryRaw, runCommandRaw):

- Build roots keyed only by action name (no modelName)
- These args are expected to be non-parameterizable, but roots keep traversal
  uniform

## Step 5: String Table

Collect all field names used in input and output nodes into a string table.
Edges reference strings by index. Build a reverse map (`Map<string, number>`) at
runtime for fast lookup.
