import type { MongoSchemaCollection } from './schema-collection';
import type { MongoSchemaCollectionOptions } from './schema-collection-options';
import type { MongoSchemaIndex } from './schema-index';
import type { MongoSchemaIR } from './schema-ir';
import type { MongoSchemaValidator } from './schema-validator';

export interface MongoSchemaVisitor<R> {
  schema(node: MongoSchemaIR): R;
  collection(node: MongoSchemaCollection): R;
  index(node: MongoSchemaIndex): R;
  validator(node: MongoSchemaValidator): R;
  collectionOptions(node: MongoSchemaCollectionOptions): R;
}
