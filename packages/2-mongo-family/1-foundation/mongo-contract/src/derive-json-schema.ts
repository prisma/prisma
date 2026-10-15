import type {
  ContractEmbedRelation,
  ContractField,
  ContractModelBase,
  ContractRelation,
  ContractValueObject,
  JsonValue,
} from '@internal/contract/types';
import { assertDefined } from '@internal/utils/assertions';
import { structuredError } from '@internal/utils/structured-error';
import { MongoValidator } from './ir/mongo-validator';
import { bsonTypesOfCodec, type MongoTypeLookups } from './mongo-data-type';

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

interface SchemaSources {
  readonly lookups: MongoTypeLookups;
  readonly valueObjects: Record<string, ContractValueObject> | undefined;
  readonly valueSets: FieldValueSets | undefined;
  readonly models: Record<string, ValidatorModel>;
  /** The models being described, from the root, with the embed relation between each pair: `[Root, nodes, Node]`. */
  readonly embedPath: readonly string[];
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

function isEmbedRelation(relation: ContractRelation): relation is ContractEmbedRelation {
  return !('on' in relation) && !('through' in relation);
}

function fieldToBsonSchema(
  field: ContractField,
  sources: SchemaSources,
): Record<string, unknown> | undefined {
  const { lookups, valueObjects, valueSets } = sources;
  if (field.type.kind === 'scalar') {
    const bsonTypes = bsonTypesOfCodec(field.type.codecId, lookups);
    if (bsonTypes === undefined) return undefined;
    if (bsonTypes.length === 0) return anyValueSchema(field);
    const bsonType = bsonTypeKeyword(bsonTypes);

    const enumValues =
      field.valueSet !== undefined
        ? (valueSets?.[field.valueSet.entityName]?.values ?? null)
        : null;

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
    const vo = valueObjects?.[field.type.name];
    if (!vo) return undefined;
    const voSchema = deriveObjectSchema({ fields: vo.fields, relations: NO_RELATIONS }, sources);
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
  relationName: string,
  relation: ContractEmbedRelation,
  sources: SchemaSources,
): Record<string, unknown> {
  const embeddedName = relation.to.model;
  const embedded = sources.models[embeddedName];
  assertDefined(embedded, `Embedded model "${embeddedName}" is missing`);
  const embedPath = [...sources.embedPath, relationName, embeddedName];
  const cycleStart = sources.embedPath.findIndex(
    (name, index) => index % 2 === 0 && name === embeddedName,
  );
  if (cycleStart !== -1) {
    const chain = embedPath.slice(cycleStart);
    throw structuredError(
      'CONTRACT.RELATION_INVALID',
      `Embedded model "${embeddedName}" embeds itself: ${chain.join(' → ')}. A collection validator cannot describe a recursive embed.`,
      { meta: { chain } },
    );
  }
  const schema = deriveObjectSchema(embedded, { ...sources, embedPath });
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
    properties[relationName] = embedToBsonSchema(relationName, relation, sources);
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

function validatorOf(jsonSchema: Record<string, unknown>): MongoValidator {
  return new MongoValidator({ jsonSchema, validationLevel: 'strict', validationAction: 'error' });
}

export function deriveJsonSchema(
  fields: Record<string, ContractField>,
  lookups: MongoTypeLookups,
  valueObjects?: Record<string, ContractValueObject>,
  valueSets?: FieldValueSets,
): MongoValidator {
  return validatorOf(
    deriveObjectSchema(
      { fields, relations: NO_RELATIONS },
      { lookups, valueObjects, valueSets, models: {}, embedPath: [] },
    ),
  );
}

export interface PolymorphicVariant {
  readonly discriminatorValue: string;
  readonly fields: Record<string, ContractField>;
}

interface StoredVariant extends StoredShape {
  readonly discriminatorValue: string;
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
    const { properties: variantProperties, required } = propertiesOf(variant, sources, base);

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

export function derivePolymorphicJsonSchema(
  baseFields: Record<string, ContractField>,
  discriminatorField: string,
  variants: readonly PolymorphicVariant[],
  lookups: MongoTypeLookups,
  valueObjects?: Record<string, ContractValueObject>,
  valueSets?: FieldValueSets,
): MongoValidator {
  return validatorOf(
    polymorphicSchema(
      { fields: baseFields, relations: NO_RELATIONS },
      discriminatorField,
      variants.map((variant) => ({ ...variant, relations: NO_RELATIONS })),
      { lookups, valueObjects, valueSets, models: {}, embedPath: [] },
    ),
  );
}

export interface ModelValidatorSources {
  readonly models: Record<string, ValidatorModel>;
  readonly lookups: MongoTypeLookups;
  readonly valueObjects: Record<string, ContractValueObject>;
  readonly valueSets: FieldValueSets;
}

/**
 * The validator of a root model's collection: the model's fields and embedded models, and for a model with variants one `oneOf` branch per variant.
 */
export function deriveModelValidator(
  modelName: string,
  model: ValidatorModel,
  sources: ModelValidatorSources,
): MongoValidator {
  if (!model.discriminator || !model.variants) {
    return validatorOf(deriveObjectSchema(model, { ...sources, embedPath: [modelName] }));
  }

  const variants = Object.entries(model.variants).map(([discriminatorValue, variant]) => {
    const variantModel = sources.models[variant.model];
    assertDefined(variantModel, `Variant model "${variant.model}" of "${modelName}" is missing`);
    return { discriminatorValue, ...variantModel };
  });
  return validatorOf(
    polymorphicSchema(model, model.discriminator.field, variants, {
      ...sources,
      embedPath: [modelName],
    }),
  );
}
