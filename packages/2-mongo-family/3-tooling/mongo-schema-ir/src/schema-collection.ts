import { freezeNode } from '@internal/framework-components/ir';
import type { MongoSchemaCollectionOptions } from './schema-collection-options';
import type { MongoSchemaIndex } from './schema-index';
import { MongoSchemaIRNode } from './schema-node';
import type { MongoSchemaValidator } from './schema-validator';
import type { MongoSchemaVisitor } from './visitor';

export interface MongoSchemaCollectionCtorOptions {
  readonly name: string;
  readonly indexes?: ReadonlyArray<MongoSchemaIndex>;
  readonly validator?: MongoSchemaValidator;
  readonly options?: MongoSchemaCollectionOptions;
}

export class MongoSchemaCollection extends MongoSchemaIRNode {
  readonly nodeKind = 'collection' as const;
  readonly id: string;
  readonly name: string;
  readonly indexes: ReadonlyArray<MongoSchemaIndex>;
  readonly validator?: MongoSchemaValidator | undefined;
  readonly options?: MongoSchemaCollectionOptions | undefined;

  constructor(options: MongoSchemaCollectionCtorOptions) {
    super();
    this.id = options.name;
    this.name = options.name;
    this.indexes = options.indexes ?? [];
    this.validator = options.validator;
    this.options = options.options;
    freezeNode(this);
  }

  accept<R>(visitor: MongoSchemaVisitor<R>): R {
    return visitor.collection(this);
  }
}
