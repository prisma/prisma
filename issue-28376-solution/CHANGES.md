# Code Changes for Issue #28376

## Summary
This document lists all the code changes made to implement the `whereUnique` feature for relation fields with compound unique constraints.

## Files Modified

### 1. `packages/client-generator-ts/src/TSClient/Args.ts`

**Added method:**
- `addWhereUniqueArg(relatedModelName: string): this` - Adds the `whereUnique` property to relation field arguments

### 2. `packages/client-generator-ts/src/TSClient/Model.ts`

**Added method:**
- `canUseWhereUnique(field: DMMF.SchemaField, relatedModelName: string): boolean` - Detects if a relation field can use `whereUnique`

**Modified method:**
- `get argsTypes()` - Added logic to include `whereUnique` when applicable

### 3. `packages/client/src/runtime/core/types/exported/Result.ts`

**Modified type:**
- `GetFindResult<P, A, GlobalOmitOptions>` - Added check for `whereUnique` to return `T | null` instead of `T[]`

## Detailed Changes

### Change 1: Args.ts
```typescript
// Added after addOmitArg() method
addWhereUniqueArg(relatedModelName: string): this {
  const whereUniqueInputType = `${relatedModelName}WhereUniqueInput`
  this.addProperty(
    ts
      .property(
        'whereUnique',
        ts.unionType([
          ts.namedType(`Prisma.${whereUniqueInputType}`).addGenericArgument(extArgsParam.toArgument()),
          ts.nullType,
        ]),
      )
      .optional()
      .setDocComment(
        ts.docComment(
          `Filter by unique fields on the related ${relatedModelName} model. Returns 0 or 1 result instead of an array.`,
        ),
      ),
  )
  return this
}
```

### Change 2: Model.ts
```typescript
// Added helper method
private canUseWhereUnique(field: DMMF.SchemaField, relatedModelName: string): boolean {
  // ... implementation
}

// Modified in argsTypes getter
const argsBuilder = new ArgsTypeBuilder(fieldOutput, this.context)
  .addSelectArg()
  .addOmitArg()
  .addIncludeArgIfHasRelations()
  .addSchemaArgs(field.args)

if (field.outputType.isList && this.canUseWhereUnique(field, fieldOutput.name)) {
  argsBuilder.addWhereUniqueArg(fieldOutput.name)
}
```

### Change 3: Result.ts
```typescript
// Modified GetFindResult type to check for whereUnique
(S & I)[K] extends { whereUnique: any }
  ? P extends SelectablePayloadFields<K, (infer O)[]>
    ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], GlobalOmitOptions> | SelectField<P, K> & null : never
    : // ... handle non-array case
  : // ... existing array handling
```

## Testing Recommendations

1. Test with the example schema from the issue
2. Verify type checking works correctly
3. Test with nested relations
4. Test edge cases (no compound unique, single field unique, etc.)
5. Verify runtime behavior matches type expectations

