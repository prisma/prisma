import type {
  ContractEmbedRelation,
  ContractField,
  ContractModelBase,
  ContractRelation,
  ContractValueObject,
  JsonValue,
} from '@internal/contract/types';
import { assertDefined } from '@internal/utils/assertions';
import { MongoValidator } from './ir/mongo-validator';
import { bsonTypesOfCodec, type MongoTypeLookups } from './mongo-data-type';
import { recursiveGroupsOf, typeKey } from './recursive-groups';
import { isEmbedRelation } from './relation-fields';

/**
 * The permitted values a field's value set restricts it to, keyed by the value set's name — the
 * storage `entries.valueSet` slot. The validator's `enum` keyword is sourced from these, not from
 * `domain.enum`.
 */
export type FieldValueSets = Record<string, { readonly values: readonly JsonValue[] }>;

export type ValidatorModel = Pick<
  ContractModelBase,
  'fields' | 'relations' | 'discriminator' | 'variants'
>;

interface SchemaSources extends ModelValidatorSources {
  /** The recursive group of each value object and embedded model in one, from {@link recursiveGroupsOf}. */
  readonly groups: ReadonlyMap<string, number>;
  /** The recursive groups entered on the path from the root to the schema being written. */
  readonly enteredGroups: ReadonlySet<number>;
}

/**
 * `$jsonSchema` has no references, so a type that contains itself, directly or through other types, cannot be described at every depth. The validator describes the type through which a path enters a recursive group in full, and accepts any object for each field below it that refers back into that group. So each group is written out once for each place a document enters it, and no valid document is refused.
 */
const OPEN_OBJECT: Record<string, unknown> = { bsonType: 'object' };

function sourcesFor(input: ModelValidatorSources, rootKey: string): SchemaSources {
  const groups = recursiveGroupsOf(input.valueObjects, input.models);
  const rootGroup = groups.get(rootKey);
  return {
    ...input,
    groups,
    enteredGroups: new Set(rootGroup === undefined ? [] : [rootGroup]),
  };
}

function objectSchemaOf(
  kind: 'valueObject' | 'model',
  name: string,
  shape: StoredShape,
  sources: SchemaSources,
): Record<string, unknown> {
  const key = typeKey(kind, name);
  const group = sources.groups.get(key);
  if (group !== undefined && sources.enteredGroups.has(group)) return OPEN_OBJECT;
  return deriveObjectSchema(shape, entering(key, sources));
}

/** `sources` with the recursive group of the type `key` entered, if it has one. */
function entering(key: string, sources: SchemaSources): SchemaSources {
  const group = sources.groups.get(key);
  if (group === undefined || sources.enteredGroups.has(group)) return sources;
  return { ...sources, enteredGroups: new Set([...sources.enteredGroups, group]) };
}

interface StoredShape {
  readonly fields: Record<string, ContractField>;
  readonly relations: Record<string, ContractRelation>;
}

const NO_RELATIONS: Record<string, ContractRelation> = {};

const NOTHING_INHERITED: StoredShape = { fields: {}, relations: NO_RELATIONS };

/**
 * The `bsonType` keyword for a list of BSON type names: the name itself for one entry, the list for several.
 */
function bsonTypeKeyword(bsonTypes: readonly string[]): string | readonly string[] {
  const [only, ...rest] = bsonTypes;
  return only !== undefined && rest.length === 0 ? only : [...bsonTypes];
}

function withNull(bsonTypes: readonly string[]): readonly string[] {
  return bsonTypes.includes('null') ? bsonTypes : ['null', ...bsonTypes];
}

function anyValueSchema(field: ContractField): Record<string, unknown> {
  if ('many' in field && field.many) {
    return { bsonType: field.nullable ? ['null', 'array'] : 'array', items: {} };
  }
  return {};
}

function fieldToBsonSchema(
  field: ContractField,
  sources: SchemaSources,
): Record<string, unknown> | undefined {
  const { lookups, valueObjects, valueSets } = sources;
  if (field.type.kind === 'scalar') {
    const bsonTypes = bsonTypesOfCodec(field.type.codecId, lookups);
    assertDefined(
      bsonTypes,
      `Field codec "${field.type.codecId}" has no MongoDB data type; the authoring surface refuses such a field before it derives the validator`,
    );
    if (bsonTypes.length === 0) return anyValueSchema(field);
    const bsonType = bsonTypeKeyword(bsonTypes);

    const enumValues =
      field.valueSet !== undefined ? (valueSets[field.valueSet.entityName]?.values ?? null) : null;

    if (field.many) {
      const items: Record<string, unknown> = {
        bsonType: field.many.elementNullable ? ['null', bsonType] : bsonType,
      };
      if (enumValues) {
        items['enum'] = field.many.elementNullable ? [...enumValues, null] : enumValues;
      }
      return { bsonType: field.nullable ? ['null', 'array'] : 'array', items };
    }

    if (field.nullable) {
      const s: Record<string, unknown> = { bsonType: bsonTypeKeyword(withNull(bsonTypes)) };
      if (enumValues) s['enum'] = [...enumValues, null];
      return s;
    }

    const s: Record<string, unknown> = { bsonType };
    if (enumValues) s['enum'] = enumValues;
    return s;
  }

  if (field.type.kind === 'valueObject') {
    const vo = valueObjects[field.type.name];
    if (!vo) return undefined;
    const voSchema = objectSchemaOf(
      'valueObject',
      field.type.name,
      { fields: vo.fields, relations: NO_RELATIONS },
      sources,
    );
    if (field.many) {
      return {
        bsonType: field.nullable ? ['null', 'array'] : 'array',
        items: field.many.elementNullable ? { oneOf: [{ bsonType: 'null' }, voSchema] } : voSchema,
      };
    }
    if (field.nullable) {
      return { oneOf: [{ bsonType: 'null' }, voSchema] };
    }
    return voSchema;
  }

  return undefined;
}

/**
 * An embedded model is stored inside its owner's document as a closed object (a list of them for `1:N`). The contract does not say whether one must be present, and the ORM creates documents without them, so the property is never required.
 */
function embedToBsonSchema(
  relation: ContractEmbedRelation,
  sources: SchemaSources,
): Record<string, unknown> {
  const embeddedName = relation.to.model;
  const embedded = sources.models[embeddedName];
  assertDefined(embedded, `Embedded model "${embeddedName}" is missing`);
  const schema = objectSchemaOf('model', embeddedName, embedded, sources);
  return relation.cardinality === '1:N' ? { bsonType: 'array', items: schema } : schema;
}

/**
 * The properties of `shape`, leaving out the fields and relations `inherited` already describes.
 */
function propertiesOf(
  shape: StoredShape,
  sources: SchemaSources,
  inherited: StoredShape,
): { properties: Record<string, unknown>; required: string[] } {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [fieldName, field] of Object.entries(shape.fields)) {
    if (Object.hasOwn(inherited.fields, fieldName)) continue;
    const schema = fieldToBsonSchema(field, sources);
    if (schema) {
      properties[fieldName] = schema;
      if (!field.nullable) {
        required.push(fieldName);
      }
    }
  }

  for (const [relationName, relation] of Object.entries(shape.relations)) {
    if (Object.hasOwn(inherited.relations, relationName) || !isEmbedRelation(relation)) continue;
    properties[relationName] = embedToBsonSchema(relation, sources);
  }

  return { properties, required };
}

function deriveObjectSchema(shape: StoredShape, sources: SchemaSources): Record<string, unknown> {
  const { properties, required } = propertiesOf(shape, sources, NOTHING_INHERITED);

  const result: Record<string, unknown> = {
    bsonType: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) {
    result['required'] = required.sort();
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validatorOf(jsonSchema: Record<string, unknown>): MongoValidator {
  return new MongoValidator({ jsonSchema, validationLevel: 'strict', validationAction: 'error' });
}

interface StoredVariant extends StoredShape {
  readonly discriminatorValue: string;
  /** A variant in a recursive group enters it, as a root model does. */
  readonly modelName: string;
}

function polymorphicSchema(
  base: StoredShape,
  discriminatorField: string,
  variants: readonly StoredVariant[],
  sources: SchemaSources,
): Record<string, unknown> {
  const baseSchema = deriveObjectSchema(base, sources);
  const baseProperties = isRecord(baseSchema['properties']) ? baseSchema['properties'] : {};

  const oneOf: Record<string, unknown>[] = [];
  for (const variant of variants) {
    const { properties: variantProperties, required } = propertiesOf(
      variant,
      entering(typeKey('model', variant.modelName), sources),
      base,
    );

    oneOf.push({
      properties: {
        ...baseProperties,
        [discriminatorField]: { enum: [variant.discriminatorValue] },
        ...variantProperties,
      },
      required: [discriminatorField, ...required].sort(),
      additionalProperties: false,
    });
  }

  const jsonSchema = { ...baseSchema };
  delete jsonSchema['additionalProperties'];
  if (oneOf.length > 0) {
    jsonSchema['oneOf'] = oneOf;
  }
  return jsonSchema;
}

export interface ModelValidatorSources {
  readonly models: Record<string, ValidatorModel>;
  readonly lookups: MongoTypeLookups;
  readonly valueObjects: Record<string, ContractValueObject>;
  readonly valueSets: FieldValueSets;
}

/**
 * The `$jsonSchema` of a root model's documents: the model's fields and embedded models, and for a model with variants one `oneOf` branch per variant.
 */
export function deriveModelJsonSchema(
  modelName: string,
  model: ValidatorModel,
  sources: ModelValidatorSources,
): Record<string, unknown> {
  const schemaSources = sourcesFor(sources, typeKey('model', modelName));
  if (!model.discriminator || !model.variants) {
    return deriveObjectSchema(model, schemaSources);
  }

  const variants = Object.entries(model.variants).map(([discriminatorValue, variant]) => {
    const variantModel = sources.models[variant.model];
    assertDefined(variantModel, `Variant model "${variant.model}" of "${modelName}" is missing`);
    return { discriminatorValue, modelName: variant.model, ...variantModel };
  });
  return polymorphicSchema(model, model.discriminator.field, variants, schemaSources);
}
