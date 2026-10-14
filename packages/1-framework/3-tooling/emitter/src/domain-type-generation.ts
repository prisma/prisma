import type {
  ContractField,
  ContractManyToManyRelation,
  ContractModelBase,
  ContractValueObject,
  CrossReference,
  JsonValue,
} from '@internal/contract/types';
import type { CodecLookup } from '@internal/framework-components/codec';
import {
  type ImportSpecifierResolver,
  keepInternalSpecifiers,
  type TypesImportSpec,
} from '@internal/framework-components/emission';
import { type ImportRequirement, renderImports, tsStringLiteral } from '@internal/ts-render';
import { blindCast } from '@internal/utils/casts';
import { emitterError } from './emitter-errors';
import { isSafeTypeExpression } from './type-expression-safety';

export function serializeValue(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'string') {
    return tsStringLiteral(value);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'bigint') {
    return `${value}n`;
  }
  if (Array.isArray(value)) {
    const items = value.map((v) => serializeValue(v)).join(', ');
    return `readonly [${items}]`;
  }
  if (typeof value === 'object') {
    // Key order carries no meaning in a literal type, and the same contract
    // reaches here in authoring order from the source and in canonical order
    // from contract.json. Sorting makes both render the same text.
    const entries = Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([k, v]) => `readonly ${serializeObjectKey(k)}: ${serializeValue(v)}`);
    return `{ ${entries.join('; ')} }`;
  }
  return 'unknown';
}

export function serializeObjectKey(key: string): string {
  if (/^[$A-Z_a-z][$\w]*$/.test(key)) {
    return key;
  }
  return serializeValue(key);
}

export function serializeNamespaceId(value: string): string {
  return `${serializeValue(value)} & NamespaceId`;
}

export function serializeCrossReference(ref: CrossReference): string {
  const namespace = serializeNamespaceId(String(ref.namespace));
  const model = serializeValue(ref.model);
  const space = ref.space !== undefined ? `; readonly space: ${serializeValue(ref.space)}` : '';
  return `{ readonly namespace: ${namespace}; readonly model: ${model}${space} }`;
}

export function generateRootsType(roots: Record<string, CrossReference> | undefined): string {
  if (!roots || Object.keys(roots).length === 0) {
    return 'Record<string, never>';
  }
  const entries = Object.entries(roots)
    .map(([key, value]) => `readonly ${serializeObjectKey(key)}: ${serializeCrossReference(value)}`)
    .join('; ');
  return `{ ${entries} }`;
}

function contractFieldModifierSuffix(field: ContractField): string {
  const many = field.many
    ? `; readonly many: { readonly elementNullable: ${field.many.elementNullable} }`
    : '';
  const dict = field.dict === true ? '; readonly dict: true' : '';
  return many + dict;
}

export function generateModelFieldEntry(fieldName: string, field: ContractField): string {
  const mods = contractFieldModifierSuffix(field);
  const { nullable, type } = field;
  if (type.kind === 'scalar') {
    const typeParamsSpec =
      type.typeParams && Object.keys(type.typeParams).length > 0
        ? `; readonly typeParams: ${serializeValue(type.typeParams)}`
        : '';
    return `readonly ${serializeObjectKey(fieldName)}: { readonly nullable: ${nullable}; readonly type: { readonly kind: "scalar"; readonly codecId: ${serializeValue(type.codecId)}${typeParamsSpec} }${mods} }`;
  }
  if (type.kind === 'valueObject') {
    return `readonly ${serializeObjectKey(fieldName)}: { readonly nullable: ${nullable}; readonly type: { readonly kind: "valueObject"; readonly name: ${serializeValue(type.name)} }${mods} }`;
  }
  return `readonly ${serializeObjectKey(fieldName)}: { readonly nullable: ${nullable}; readonly type: ${serializeValue(type)}${mods} }`;
}

// An empty field map is `{}` in a descriptor or output (row) type, since `keyof Record<string, never>` is `string`, and `Record<string, never>` in an input type, since TypeScript accepts any object where `{}` is expected.
function objectTypeOpenWhenEmpty(entries: readonly string[]): string {
  return entries.length > 0 ? `{ ${entries.join('; ')} }` : '{}';
}

function objectTypeClosedWhenEmpty(entries: readonly string[]): string {
  return entries.length > 0 ? `{ ${entries.join('; ')} }` : 'Record<string, never>';
}

export function generateModelFieldsType(fields: Record<string, ContractField>): string {
  const fieldEntries: string[] = [];
  for (const [fieldName, field] of Object.entries(fields)) {
    fieldEntries.push(generateModelFieldEntry(fieldName, field));
  }
  return objectTypeOpenWhenEmpty(fieldEntries);
}

export function generateModelRelationsType(relations: Record<string, unknown>): string {
  const relationEntries: string[] = [];

  for (const [relName, rel] of Object.entries(relations)) {
    if (typeof rel !== 'object' || rel === null) continue;
    const relObj = blindCast<
      Record<string, unknown>,
      'relation narrowed to a non-null object above'
    >(rel);

    // Option B: cross-space relations are declared but non-navigable.
    // A relation whose `to.space` is set lives in a foreign contract space;
    // emitting `never` for its entry makes `include` of it a compile error
    // while the relation is still present in the contract JSON for introspection.
    const toRef = relObj['to'];
    // Option B: cross-space relations are declared but non-navigable.
    // When the relation's `to` ref carries a `space` field the target lives
    // in a foreign contract space; emit `never` so `include` of it is a
    // compile error while the relation stays in the contract JSON.
    if (
      toRef !== null &&
      typeof toRef === 'object' &&
      'space' in toRef &&
      toRef.space !== undefined
    ) {
      relationEntries.push(`readonly ${serializeObjectKey(relName)}: never`);
      continue;
    }

    const parts: string[] = [];

    if (toRef)
      parts.push(
        `readonly to: ${serializeCrossReference(blindCast<CrossReference, 'contract JSON schema-validated before serialization; truthy check above confirms presence'>(toRef))}`,
      );
    if (relObj['cardinality'])
      parts.push(`readonly cardinality: ${serializeValue(relObj['cardinality'])}`);
    if (typeof relObj['nullable'] === 'boolean')
      parts.push(`readonly nullable: ${relObj['nullable']}`);

    const on = blindCast<
      { localFields?: string[]; targetFields?: string[] } | undefined,
      'contract relation on block is validated before type generation'
    >(relObj['on']);
    if (on && (!on.localFields || !on.targetFields)) {
      throw emitterError(
        'CONTRACT.RELATION_INVALID',
        `Relation "${relName}" has an "on" block but is missing localFields or targetFields`,
        { meta: { relation: relName } },
      );
    }
    if (on?.localFields && on.targetFields) {
      const localFields = on.localFields.map((f) => serializeValue(f)).join(', ');
      const targetFields = on.targetFields.map((f) => serializeValue(f)).join(', ');
      parts.push(
        `readonly on: { readonly localFields: readonly [${localFields}]; readonly targetFields: readonly [${targetFields}] }`,
      );
    }

    if (relObj['cardinality'] === 'N:M') {
      const { through } = blindCast<
        ContractManyToManyRelation,
        'contract JSON schema-validated before serialization; cardinality N:M check above confirms the junction variant carries through'
      >(relObj);
      const table = serializeValue(through.table);
      const namespaceId = serializeValue(through.namespaceId);
      const parentColumns = through.parentColumns.map((c) => serializeValue(c)).join(', ');
      const childColumns = through.childColumns.map((c) => serializeValue(c)).join(', ');
      const targetColumns = through.targetColumns.map((c) => serializeValue(c)).join(', ');
      parts.push(
        `readonly through: { readonly table: ${table}; readonly namespaceId: ${namespaceId}; readonly parentColumns: readonly [${parentColumns}]; readonly childColumns: readonly [${childColumns}]; readonly targetColumns: readonly [${targetColumns}] }`,
      );
    }

    if (parts.length > 0) {
      relationEntries.push(`readonly ${serializeObjectKey(relName)}: { ${parts.join('; ')} }`);
    }
  }

  if (relationEntries.length === 0) {
    return 'Record<string, never>';
  }

  return `{ ${relationEntries.join('; ')} }`;
}

export function generateModelsType(
  models: Record<string, ContractModelBase>,
  generateModelStorage: (modelName: string, model: ContractModelBase) => string,
): string {
  if (!models || Object.keys(models).length === 0) {
    return 'Record<string, never>';
  }

  const modelTypes: string[] = [];
  for (const [modelName, model] of Object.entries(models).sort(([a], [b]) => a.localeCompare(b))) {
    const fieldsType = generateModelFieldsType(model.fields);
    const relationsType = generateModelRelationsType(model.relations);
    const storageType = generateModelStorage(modelName, model);

    const modelParts: string[] = [
      `readonly fields: ${fieldsType}`,
      `readonly relations: ${relationsType}`,
      `readonly storage: ${storageType}`,
    ];

    if (model.owner) {
      modelParts.push(`readonly owner: ${serializeValue(model.owner)}`);
    }
    if (model.discriminator) {
      modelParts.push(`readonly discriminator: ${serializeValue(model.discriminator)}`);
    }
    if (model.variants) {
      const variantEntries = Object.entries(model.variants)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(
          ([value, ref]) =>
            `readonly ${serializeObjectKey(value)}: ${serializeCrossReference(ref)}`,
        );
      modelParts.push(`readonly variants: { ${variantEntries.join('; ')} }`);
    }
    if (model.base) {
      modelParts.push(`readonly base: ${serializeCrossReference(model.base)}`);
    }

    modelTypes.push(`readonly ${serializeObjectKey(modelName)}: { ${modelParts.join('; ')} }`);
  }

  return `{ ${modelTypes.join('; ')} }`;
}

export function deduplicateImports(imports: TypesImportSpec[]): TypesImportSpec[] {
  const seenKeys = new Set<string>();
  const result: TypesImportSpec[] = [];
  for (const imp of imports) {
    const key = `${imp.package}::${imp.named}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      result.push(imp);
    }
  }
  return result;
}

export function generateImportLines(
  imports: TypesImportSpec[],
  resolveImportSpecifier: ImportSpecifierResolver = keepInternalSpecifiers,
): string[] {
  const requirements: ImportRequirement[] = imports.map((imp) => ({
    moduleSpecifier: resolveImportSpecifier(imp.package),
    symbol: imp.named,
    alias: imp.alias,
    typeOnly: true,
  }));
  const rendered = renderImports(requirements);
  return rendered === '' ? [] : rendered.split('\n');
}

export function generateCodecTypeIntersection(
  imports: ReadonlyArray<TypesImportSpec>,
  named: string,
): string {
  const aliases = imports.filter((imp) => imp.named === named).map((imp) => imp.alias);
  return aliases.join(' & ') || 'Record<string, never>';
}

export function serializeExecutionType(execution: Record<string, unknown>): string {
  const parts: string[] = ['readonly executionHash: ExecutionHash'];
  for (const [key, value] of Object.entries(execution)) {
    if (key === 'executionHash') continue;
    parts.push(`readonly ${serializeObjectKey(key)}: ${serializeValue(value)}`);
  }
  return `{ ${parts.join('; ')} }`;
}

export function generateHashTypeAliases(hashes: {
  readonly storageHash: string;
  readonly executionHash?: string;
  readonly profileHash: string;
}): string {
  const executionHashType = hashes.executionHash
    ? `ExecutionHashBase<${serializeValue(hashes.executionHash)}>`
    : 'ExecutionHashBase<string>';

  return [
    `export type StorageHash = StorageHashBase<${serializeValue(hashes.storageHash)}>;`,
    `export type ExecutionHash = ${executionHashType};`,
    `export type ProfileHash = ProfileHashBase<${serializeValue(hashes.profileHash)}>;`,
  ].join('\n');
}

export type ResolvedFieldType = { readonly input: string; readonly output: string };

function applyModifiers(base: string, field: ContractField): string {
  let result = base;
  if (field.many) {
    if (field.many.elementNullable) result = `${result} | null`;
    result = `ReadonlyArray<${result}>`;
  }
  if (field.dict === true) result = `Readonly<Record<string, ${result}>>`;
  if (field.nullable) result = `${result} | null`;
  return result;
}

/**
 * A field's permitted values (codec-encoded) plus the codec that types them, as supplied by the
 * family-specific {@link EmissionSpi.resolveFieldValueSet}. The framework renders these into a TS
 * literal union through the codec seam ({@link renderValueSetType}).
 */
export type ResolvedFieldValueSet = {
  readonly encodedValues: readonly JsonValue[];
  readonly codecId: string;
};

export type FieldValueSetResolver = (
  modelName: string,
  fieldName: string,
  model: ContractModelBase,
) => ResolvedFieldValueSet | undefined;

/**
 * Renders a value set (a field/column's permitted values, codec-encoded) into a TS literal union by
 * routing **each** value through the codec's `renderValueLiteral` — the seam owned by the codec, not
 * a generic serializer. `side`: `output` = read type, `input` = create/update type.
 *
 * Returns `undefined` — signalling the caller to fall back to the codec's full output type — when
 * the lookup is absent, has no `renderValueLiteralFor`, the value set is empty, or **any** value
 * isn't literal-expressible. A caller that needs column and field types to agree shares this so both
 * compute the union identically.
 */
export function renderValueSetType(
  values: readonly JsonValue[],
  codecId: string,
  side: 'output' | 'input',
  codecLookup: CodecLookup | undefined,
): string | undefined {
  if (values.length === 0 || codecLookup?.renderValueLiteralFor === undefined) return undefined;
  const literals: string[] = [];
  for (const value of values) {
    const lit = codecLookup.renderValueLiteralFor(codecId, value, side);
    if (lit === undefined || !isSafeTypeExpression(lit)) return undefined;
    literals.push(lit);
  }
  return literals.join(' | ');
}

/** The local alias an emitted `contract.d.ts` types a column with type parameters through. */
export const PARAMETERIZED_OUTPUT = 'ParameterizedOutput';

/** The local alias for the union of the stack's parameterized output type functions. */
export const PARAMETERIZED_OUTPUT_TYPES = 'ParameterizedOutputTypes';

/** The declaration of {@link PARAMETERIZED_OUTPUT}: `ParameterizedOutputType` from `@internal/contract/types` applied to {@link PARAMETERIZED_OUTPUT_TYPES}, falling back to the codec's plain output type. */
export const parameterizedOutputAlias = `type ${PARAMETERIZED_OUTPUT}<CodecId extends keyof CodecTypes, TypeParams extends Record<string, unknown>> = ParameterizedOutputType<${PARAMETERIZED_OUTPUT_TYPES}, CodecId, TypeParams, CodecTypes[CodecId]["output"]>;`;

/** The declaration of {@link PARAMETERIZED_OUTPUT_TYPES} for the type functions the stack's components declare. */
export function parameterizedOutputTypesAlias(
  typeFunctions: ReadonlyArray<TypesImportSpec>,
): string {
  const aliases = [...new Set(typeFunctions.map((typeFunction) => typeFunction.alias))];
  return `type ${PARAMETERIZED_OUTPUT_TYPES} = ${aliases.length > 0 ? aliases.join(' | ') : 'never'};`;
}

/**
 * The output type of a value of codec `codecId` in a column with these type parameters. A codec that renders its own type text (`renderOutputType`) gets that text. Otherwise, when the codec's contributor declares a type function for parameterized output types, the type applies it, through {@link PARAMETERIZED_OUTPUT}, so the pack's type-level declaration is the only one. Otherwise it is the codec's plain output type.
 */
export function codecOutputType(
  codecId: string,
  typeParams: Record<string, unknown> | undefined,
  codecLookup: CodecLookup | undefined,
): string {
  const plain = `CodecTypes[${serializeValue(codecId)}]["output"]`;
  if (codecLookup === undefined || typeParams === undefined) return plain;
  const rendered = codecLookup.renderOutputTypeFor(codecId, typeParams);
  if (rendered && isSafeTypeExpression(rendered)) return rendered;
  const typeFunction = codecLookup.parameterizedOutputTypesFor?.(codecId);
  if (typeFunction === undefined) return plain;
  return `${PARAMETERIZED_OUTPUT}<${serializeValue(codecId)}, ${serializeValue(typeParams)}>`;
}

/** The input type of a value of codec `codecId` in a column with these type parameters: the text the codec renders (`renderInputType`), or its plain input type. */
export function codecInputType(
  codecId: string,
  typeParams: Record<string, unknown> | undefined,
  codecLookup: CodecLookup | undefined,
): string {
  if (codecLookup !== undefined && typeParams !== undefined) {
    const rendered = codecLookup.renderInputTypeFor?.(codecId, typeParams);
    if (rendered && isSafeTypeExpression(rendered)) return rendered;
  }
  return `CodecTypes[${serializeValue(codecId)}]["input"]`;
}

export function resolveFieldType(
  field: ContractField,
  codecLookup?: CodecLookup,
  resolvedValueSet?: ResolvedFieldValueSet,
): ResolvedFieldType {
  const { type } = field;

  switch (type.kind) {
    case 'scalar': {
      if (resolvedValueSet) {
        const output = renderValueSetType(
          resolvedValueSet.encodedValues,
          resolvedValueSet.codecId,
          'output',
          codecLookup,
        );
        const input = renderValueSetType(
          resolvedValueSet.encodedValues,
          resolvedValueSet.codecId,
          'input',
          codecLookup,
        );
        if (output !== undefined && input !== undefined) {
          return {
            output: applyModifiers(output, field),
            input: applyModifiers(input, field),
          };
        }
      }
      const typeParams =
        type.typeParams && Object.keys(type.typeParams).length > 0 ? type.typeParams : undefined;
      return {
        output: applyModifiers(codecOutputType(type.codecId, typeParams, codecLookup), field),
        input: applyModifiers(codecInputType(type.codecId, typeParams, codecLookup), field),
      };
    }
    case 'valueObject':
      return {
        output: applyModifiers(`${type.name}Output`, field),
        input: applyModifiers(`${type.name}Input`, field),
      };
    case 'union': {
      const outputMembers = type.members.map((m) =>
        m.kind === 'scalar'
          ? `CodecTypes[${serializeValue(m.codecId)}]["output"]`
          : `${m.name}Output`,
      );
      const inputMembers = type.members.map((m) =>
        m.kind === 'scalar'
          ? `CodecTypes[${serializeValue(m.codecId)}]["input"]`
          : `${m.name}Input`,
      );
      return {
        output: applyModifiers(outputMembers.join(' | '), field),
        input: applyModifiers(inputMembers.join(' | '), field),
      };
    }
    default:
      return {
        output: applyModifiers('unknown', field),
        input: applyModifiers('unknown', field),
      };
  }
}

export function generateFieldResolvedType(
  field: ContractField,
  codecLookup?: CodecLookup,
  side: 'input' | 'output' = 'output',
): string {
  return resolveFieldType(field, codecLookup)[side];
}

export type ModelFieldTypeResolvers = {
  readonly codecLookup: CodecLookup | undefined;
  readonly resolveFieldValueSet: FieldValueSetResolver | undefined;
  /** Types a `Models` member's field by indexing `FieldOutputTypes` rather than writing the type out. */
  readonly referenceFieldOutputTypes?: boolean;
};

/**
 * Resolves one model field's input and output types the way `FieldOutputTypes` /
 * `FieldInputTypes` do: the field's type parameters refine its codec's type, and a family-resolved
 * value set renders as a literal union.
 */
export function resolveModelFieldType(
  modelName: string,
  fieldName: string,
  field: ContractField,
  model: ContractModelBase,
  resolvers: ModelFieldTypeResolvers,
): ResolvedFieldType {
  const resolvedValueSet = resolvers.resolveFieldValueSet?.(modelName, fieldName, model);
  return resolveFieldType(field, resolvers.codecLookup, resolvedValueSet);
}

export function generateBothFieldTypesMaps(
  models: Record<string, ContractModelBase> | undefined,
  codecLookup?: CodecLookup,
  resolveFieldValueSet?: FieldValueSetResolver,
): ResolvedFieldType {
  if (!models || Object.keys(models).length === 0) {
    return { output: 'Record<string, never>', input: 'Record<string, never>' };
  }

  const resolvers: ModelFieldTypeResolvers = { codecLookup, resolveFieldValueSet };
  const outputModelEntries: string[] = [];
  const inputModelEntries: string[] = [];
  for (const [modelName, model] of Object.entries(models).sort(([a], [b]) => a.localeCompare(b))) {
    if (!model) continue;
    const outputFieldEntries: string[] = [];
    const inputFieldEntries: string[] = [];
    for (const [fieldName, field] of Object.entries(model.fields)) {
      const resolved = resolveModelFieldType(modelName, fieldName, field, model, resolvers);
      const key = `readonly ${serializeObjectKey(fieldName)}`;
      outputFieldEntries.push(`${key}: ${resolved.output}`);
      inputFieldEntries.push(`${key}: ${resolved.input}`);
    }
    const outputFields = objectTypeOpenWhenEmpty(outputFieldEntries);
    const inputFields = objectTypeClosedWhenEmpty(inputFieldEntries);
    const modelKey = `readonly ${serializeObjectKey(modelName)}`;
    outputModelEntries.push(`${modelKey}: ${outputFields}`);
    inputModelEntries.push(`${modelKey}: ${inputFields}`);
  }

  return {
    output: `{ ${outputModelEntries.join('; ')} }`,
    input: `{ ${inputModelEntries.join('; ')} }`,
  };
}

export function generateFieldTypesMapsByNamespace(
  namespaceModels: ReadonlyArray<readonly [string, Record<string, ContractModelBase>]>,
  codecLookup?: CodecLookup,
  resolveFieldValueSet?: FieldValueSetResolver,
): ResolvedFieldType {
  if (namespaceModels.length === 0) {
    return { output: 'Record<string, never>', input: 'Record<string, never>' };
  }

  const outputNamespaceEntries: string[] = [];
  const inputNamespaceEntries: string[] = [];
  for (const [nsId, models] of namespaceModels) {
    const inner = generateBothFieldTypesMaps(models, codecLookup, resolveFieldValueSet);
    const nsKey = `readonly ${serializeObjectKey(nsId)}`;
    outputNamespaceEntries.push(`${nsKey}: ${inner.output}`);
    inputNamespaceEntries.push(`${nsKey}: ${inner.input}`);
  }

  return {
    output: `{ ${outputNamespaceEntries.join('; ')} }`,
    input: `{ ${inputNamespaceEntries.join('; ')} }`,
  };
}

export function generateFieldOutputTypesMap(
  models: Record<string, ContractModelBase> | undefined,
  codecLookup?: CodecLookup,
): string {
  return generateBothFieldTypesMaps(models, codecLookup).output;
}

export function generateFieldInputTypesMap(
  models: Record<string, ContractModelBase> | undefined,
  codecLookup?: CodecLookup,
): string {
  return generateBothFieldTypesMaps(models, codecLookup).input;
}

export function generateValueObjectType(
  _voName: string,
  vo: ContractValueObject,
  _valueObjects: Record<string, ContractValueObject>,
  side: 'input' | 'output' = 'output',
  codecLookup?: CodecLookup,
): string {
  return resolveValueObjectType(_voName, vo, _valueObjects, codecLookup)[side];
}

export function resolveValueObjectType(
  _voName: string,
  vo: ContractValueObject,
  _valueObjects: Record<string, ContractValueObject>,
  codecLookup?: CodecLookup,
): ResolvedFieldType {
  const outputEntries: string[] = [];
  const inputEntries: string[] = [];
  for (const [fieldName, field] of Object.entries(vo.fields)) {
    const resolved = resolveFieldType(field, codecLookup);
    const key = `readonly ${serializeObjectKey(fieldName)}`;
    outputEntries.push(`${key}: ${resolved.output}`);
    inputEntries.push(`${key}: ${resolved.input}`);
  }
  const empty = 'Record<string, never>';
  return {
    output: outputEntries.length > 0 ? `{ ${outputEntries.join('; ')} }` : empty,
    input: inputEntries.length > 0 ? `{ ${inputEntries.join('; ')} }` : empty,
  };
}

export function generateContractFieldDescriptor(fieldName: string, field: ContractField): string {
  const modStr = contractFieldModifierSuffix(field);
  const { type } = field;
  if (type.kind === 'scalar') {
    const typeParamsSpec =
      type.typeParams && Object.keys(type.typeParams).length > 0
        ? `; readonly typeParams: ${serializeValue(type.typeParams)}`
        : '';
    return `readonly ${serializeObjectKey(fieldName)}: { readonly nullable: ${field.nullable}; readonly type: { readonly kind: "scalar"; readonly codecId: ${serializeValue(type.codecId)}${typeParamsSpec} }${modStr} }`;
  }
  if (type.kind === 'valueObject') {
    return `readonly ${serializeObjectKey(fieldName)}: { readonly nullable: ${field.nullable}; readonly type: { readonly kind: "valueObject"; readonly name: ${serializeValue(type.name)} }${modStr} }`;
  }
  return `readonly ${serializeObjectKey(fieldName)}: { readonly nullable: ${field.nullable}; readonly type: ${serializeValue(type)}${modStr} }`;
}

export function generateValueObjectsDescriptorType(
  valueObjects: Record<string, ContractValueObject> | undefined,
): string {
  if (!valueObjects || Object.keys(valueObjects).length === 0) {
    return 'Record<string, never>';
  }

  const voEntries: string[] = [];
  for (const [voName, vo] of Object.entries(valueObjects)) {
    const fieldEntries: string[] = [];
    for (const [fieldName, field] of Object.entries(vo.fields)) {
      fieldEntries.push(generateContractFieldDescriptor(fieldName, field));
    }
    const fieldsType =
      fieldEntries.length > 0 ? `{ ${fieldEntries.join('; ')} }` : 'Record<string, never>';
    voEntries.push(`readonly ${serializeObjectKey(voName)}: { readonly fields: ${fieldsType} }`);
  }

  return `{ ${voEntries.join('; ')} }`;
}

export function generateValueObjectTypeAliases(
  valueObjects: Record<string, ContractValueObject> | undefined,
  codecLookup?: CodecLookup,
): string {
  if (!valueObjects || Object.keys(valueObjects).length === 0) {
    return '';
  }

  const aliases: string[] = [];
  for (const [voName, vo] of Object.entries(valueObjects)) {
    const resolved = resolveValueObjectType(voName, vo, valueObjects, codecLookup);
    aliases.push(`export type ${voName}Output = ${resolved.output};`);
    aliases.push(`export type ${voName}Input = ${resolved.input};`);
  }
  return aliases.join('\n');
}

/** A field's or column's type on each side where its codec does not give it, as type text. */
export type KnownValueType = { readonly output?: string; readonly input?: string };

/**
 * The type of a field that its codec does not give, for a family that types its fields with a generic over the contract's shape: the literal union of the value set it holds, the type of a value object or union field, or the text its codec renders for its type parameters. `undefined` when the codec gives both sides.
 */
export function resolveKnownFieldType(
  field: ContractField,
  codecLookup: CodecLookup | undefined,
  resolvedValueSet: ResolvedFieldValueSet | undefined,
): KnownValueType | undefined {
  const { type } = field;
  if (type.kind !== 'scalar') {
    const resolved = resolveFieldType({ nullable: false, type }, codecLookup);
    return { output: resolved.output, input: resolved.input };
  }
  if (resolvedValueSet) {
    const known = renderKnownValueSetType(
      resolvedValueSet.encodedValues,
      resolvedValueSet.codecId,
      codecLookup,
    );
    if (known !== undefined) return known;
  }
  const typeParams =
    type.typeParams && Object.keys(type.typeParams).length > 0 ? type.typeParams : undefined;
  return renderKnownCodecType(type.codecId, typeParams, codecLookup);
}

/** The literal unions of a value set on both sides, or `undefined` when a value has no literal type. */
export function renderKnownValueSetType(
  values: readonly JsonValue[],
  codecId: string,
  codecLookup: CodecLookup | undefined,
): KnownValueType | undefined {
  const output = renderValueSetType(values, codecId, 'output', codecLookup);
  const input = renderValueSetType(values, codecId, 'input', codecLookup);
  return output !== undefined && input !== undefined ? { output, input } : undefined;
}

/** The type text a codec renders for these type parameters, on the sides it renders one. */
export function renderKnownCodecType(
  codecId: string,
  typeParams: Record<string, unknown> | undefined,
  codecLookup: CodecLookup | undefined,
): KnownValueType | undefined {
  if (codecLookup === undefined || typeParams === undefined) return undefined;
  const output = codecLookup.renderOutputTypeFor(codecId, typeParams);
  const input = codecLookup.renderInputTypeFor?.(codecId, typeParams);
  const known = {
    ...(output && isSafeTypeExpression(output) ? { output } : {}),
    ...(input && isSafeTypeExpression(input) ? { input } : {}),
  };
  return Object.keys(known).length > 0 ? known : undefined;
}

export function renderKnownValueType(known: KnownValueType): string {
  const sides = (['output', 'input'] as const).flatMap((side) => {
    const type = known[side];
    return type === undefined ? [] : [`readonly ${side}: ${type}`];
  });
  return `{ ${sides.join('; ')} }`;
}

/** A nested map of known types, ordered by name at every level, leaving out every branch with no entry. */
export function renderKnownTypesMap(
  entries: ReadonlyArray<readonly [string, string, string, KnownValueType | undefined]>,
): string {
  const known = entries
    .flatMap(([first, second, third, type]) =>
      type === undefined ? [] : [{ path: [first, second, third] as const, type }],
    )
    .sort((a, b) => comparePaths(a.path, b.path));
  return renderLevel(known, 0);
}

type KnownEntry = {
  readonly path: readonly [string, string, string];
  readonly type: KnownValueType;
};

function comparePaths(a: readonly string[], b: readonly string[]): number {
  for (let i = 0; i < a.length; i++) {
    const order = (a[i] ?? '').localeCompare(b[i] ?? '');
    if (order !== 0) return order;
  }
  return 0;
}

function renderLevel(entries: readonly KnownEntry[], depth: number): string {
  const keys = [...new Set(entries.map((entry) => entry.path[depth] ?? ''))];
  const parts = keys.map((key) => {
    const below = entries.filter((entry) => entry.path[depth] === key);
    const value =
      depth === 2 && below[0] !== undefined
        ? renderKnownValueType(below[0].type)
        : renderLevel(below, depth + 1);
    return `readonly ${serializeObjectKey(key)}: ${value}`;
  });
  return `{ ${parts.join('; ')} }`;
}

/** `KnownFieldTypes`: per namespace, model and field, the type of each field its codec does not give. */
export function generateKnownFieldTypesMap(
  namespaceModels: ReadonlyArray<readonly [string, Record<string, ContractModelBase>]>,
  codecLookup: CodecLookup | undefined,
  resolveFieldValueSet: FieldValueSetResolver | undefined,
): string {
  return renderKnownTypesMap(
    namespaceModels.flatMap(([nsId, models]) =>
      Object.entries(models ?? {}).flatMap(([modelName, model]) =>
        Object.entries(model.fields).map(
          ([fieldName, field]) =>
            [
              nsId,
              modelName,
              fieldName,
              resolveKnownFieldType(
                field,
                codecLookup,
                resolveFieldValueSet?.(modelName, fieldName, model),
              ),
            ] as const,
        ),
      ),
    ),
  );
}
