# Implementation Details for Issue #28376

## Changes Made

### 1. ArgsTypeBuilder Enhancement
**File:** `packages/client-generator-ts/src/TSClient/Args.ts`

Added a new method `addWhereUniqueArg()` that adds the `whereUnique` property to relation field arguments:

```typescript
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

### 2. Model Field Args Generation
**File:** `packages/client-generator-ts/src/TSClient/Model.ts`

Added logic to detect when a relation field can use `whereUnique`:

```typescript
private canUseWhereUnique(field: DMMF.SchemaField, relatedModelName: string): boolean {
  const relatedModel = this.dmmf.typeAndModelMap[relatedModelName]
  if (!relatedModel) {
    return false
  }

  // Check if the related model has compound unique constraints
  const compoundUniqueConstraints = relatedModel.uniqueFields.filter((fields) => fields.length > 1)
  if (compoundUniqueConstraints.length === 0) {
    return false
  }

  // Find the relation field in the parent model that connects to this field
  const parentModelField = this.model.fields.find((f) => f.name === field.name)
  if (!parentModelField || !parentModelField.relationFromFields || !parentModelField.relationToFields) {
    return false
  }

  // Check if any compound unique constraint includes all the relationToFields
  // This means the constraint can be satisfied by providing the remaining fields in whereUnique
  return compoundUniqueConstraints.some((uniqueFields) => {
    const relationToFields = parentModelField.relationToFields || []
    return relationToFields.every((fieldName) => uniqueFields.includes(fieldName))
  })
}
```

Then integrated it into the field args generation:

```typescript
const argsBuilder = new ArgsTypeBuilder(fieldOutput, this.context)
  .addSelectArg()
  .addOmitArg()
  .addIncludeArgIfHasRelations()
  .addSchemaArgs(field.args)

// Add whereUnique if the related model has compound unique constraints
if (field.outputType.isList && this.canUseWhereUnique(field, fieldOutput.name)) {
  argsBuilder.addWhereUniqueArg(fieldOutput.name)
}
```

### 3. Result Type Modification
**File:** `packages/client/src/runtime/core/types/exported/Result.ts`

Modified the `GetFindResult` type to check for `whereUnique` and return `T | null` instead of `T[]`:

```typescript
(S & I)[K] extends { whereUnique: any }
  ? P extends SelectablePayloadFields<K, (infer O)[]>
    ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], GlobalOmitOptions> | SelectField<P, K> & null : never
    : P extends SelectablePayloadFields<K, infer O | null>
      ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], GlobalOmitOptions> | SelectField<P, K> & null : never
      : never
  : // ... existing array handling
```

## How It Works

1. **Detection**: When generating field arguments, the code checks if:
   - The field is a list relation (`field.outputType.isList`)
   - The related model has compound unique constraints
   - The compound unique constraint includes all the relation fields

2. **Type Generation**: If all conditions are met, `whereUnique` is added to the field arguments with the appropriate `WhereUniqueInput` type.

3. **Result Typing**: When `whereUnique` is present in the args, the result type system returns `T | null` instead of `T[]`.

## Runtime Behavior

The `whereUnique` argument is serialized and passed to the query engine just like any other argument. The query engine should handle it by:
1. Combining the `whereUnique` fields with the implicit relation fields (from the parent model)
2. Using the compound unique constraint to find at most one matching record
3. Returning null if no record is found, or the single record if found

## Notes

- This feature only applies to list relations (`isList: true`)
- The compound unique constraint must include all the relation fields (`relationToFields`)
- The remaining fields in the compound unique constraint can be provided in `whereUnique`
- The return type is properly typed as `T | null` instead of `T[]`

