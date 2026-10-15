/**
 * Mongo data types: a data type with the BSON types a value of it is stored as. A type stored as
 * more than one BSON type lists each, and a type that accepts any BSON value lists none.
 *
 * ADR 254.
 */

import type { ContractField } from '@internal/contract/types';
import type {
  CodecLookupWithDescriptors,
  DataType,
  DataTypeLookup,
  DataTypeSpec,
} from '@internal/framework-components/codec';
import { dataType } from '@internal/framework-components/codec';
import { structuredError } from '@internal/utils/structured-error';
import { type as arktype } from 'arktype';

export interface MongoDataTypeSpec extends DataTypeSpec {
  readonly bsonTypes: readonly string[];
}

export interface MongoDataTypeFacts {
  readonly bsonTypes: readonly string[];
}

export interface MongoDataType extends DataType {
  readonly mongo: MongoDataTypeFacts;
}

export function mongoDataType(id: string, spec: MongoDataTypeSpec): MongoDataType {
  const { bsonTypes, ...frameworkSpec } = spec;
  return { ...dataType(id, frameworkSpec), mongo: { bsonTypes: [...bsonTypes] } };
}

export function isMongoDataType(type: DataType): type is MongoDataType {
  return 'mongo' in type;
}

/** The lookups that find the Mongo data type a codec represents. */
export interface MongoTypeLookups {
  readonly codecLookup: Pick<CodecLookupWithDescriptors, 'descriptorFor'>;
  readonly dataTypeLookup: Pick<DataTypeLookup, 'get'>;
}

/**
 * The BSON types a value of the codec `codecId` is stored as, read from the data type the codec
 * represents; undefined when the stack registers no such codec or Mongo data type.
 */
export function bsonTypesOfCodec(
  codecId: string,
  lookups: MongoTypeLookups,
): readonly string[] | undefined {
  const descriptor = lookups.codecLookup.descriptorFor(codecId);
  const type =
    descriptor === undefined ? undefined : lookups.dataTypeLookup.get(descriptor.dataType);
  return type !== undefined && isMongoDataType(type) ? type.mongo.bsonTypes : undefined;
}

type FieldOwner =
  | { readonly modelName: string; readonly valueObjectName?: never }
  | { readonly valueObjectName: string; readonly modelName?: never };

interface DomainNamespaceFields {
  readonly models: Readonly<
    Record<string, { readonly fields: Readonly<Record<string, ContractField>> }>
  >;
  readonly valueObjects?: Readonly<
    Record<string, { readonly fields: Readonly<Record<string, ContractField>> }>
  >;
}

/**
 * Refuses a field whose type parameters its codec's data type does not accept, such as a vector `length` of 0, with `CONTRACT.TYPE_PARAMS_INVALID`. Every Mongo contract build calls it: the type parameters a field carries reach only the TypeScript types and the emitted `contract.d.ts`, so nothing later checks them.
 */
export function assertMongoFieldTypeParams(
  namespaces: Readonly<Record<string, DomainNamespaceFields>>,
  lookups: MongoTypeLookups,
): void {
  for (const namespace of Object.values(namespaces)) {
    for (const [modelName, model] of Object.entries(namespace.models)) {
      assertFieldsTypeParams(model.fields, { modelName }, lookups);
    }
    for (const [valueObjectName, valueObject] of Object.entries(namespace.valueObjects ?? {})) {
      assertFieldsTypeParams(valueObject.fields, { valueObjectName }, lookups);
    }
  }
}

function assertFieldsTypeParams(
  fields: Readonly<Record<string, ContractField>>,
  owner: FieldOwner,
  lookups: MongoTypeLookups,
): void {
  for (const [fieldName, field] of Object.entries(fields)) {
    const { type: fieldType } = field;
    if (fieldType.kind !== 'scalar' || fieldType.typeParams === undefined) continue;
    const descriptor = lookups.codecLookup.descriptorFor(fieldType.codecId);
    const params =
      descriptor === undefined
        ? undefined
        : lookups.dataTypeLookup.get(descriptor.dataType)?.params;
    if (descriptor === undefined || params === undefined) continue;
    const result = params(fieldType.typeParams);
    if (result instanceof arktype.errors) {
      throw structuredError(
        'CONTRACT.TYPE_PARAMS_INVALID',
        `${descriptor.dataType}: ${result.summary}`,
        {
          meta: {
            dataType: descriptor.dataType,
            parameters: [...new Set(result.map((error) => error.path.map(String).join('.')))],
            ...owner,
            fieldName,
          },
        },
      );
    }
  }
}
