import { freezeNode } from '@internal/framework-components/ir';
import { MongoSchemaIRNode } from './schema-node';
import type { MongoSchemaVisitor } from './visitor';

export interface MongoSchemaValidatorOptions {
  readonly jsonSchema: Record<string, unknown>;
  readonly validationLevel: 'strict' | 'moderate';
  readonly validationAction: 'error' | 'warn';
}

export class MongoSchemaValidator extends MongoSchemaIRNode {
  readonly nodeKind = 'validator' as const;
  /** Fixed sentinel: at most one validator exists per collection. */
  readonly id = 'validator';
  readonly jsonSchema: Record<string, unknown>;
  readonly validationLevel: 'strict' | 'moderate';
  readonly validationAction: 'error' | 'warn';

  constructor(options: MongoSchemaValidatorOptions) {
    super();
    this.jsonSchema = options.jsonSchema;
    this.validationLevel = options.validationLevel;
    this.validationAction = options.validationAction;
    freezeNode(this);
  }

  accept<R>(visitor: MongoSchemaVisitor<R>): R {
    return visitor.validator(this);
  }
}
