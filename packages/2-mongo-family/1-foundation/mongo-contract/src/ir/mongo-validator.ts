import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';

export type MongoValidatorValidationLevel = 'strict' | 'moderate';
export type MongoValidatorValidationAction = 'error' | 'warn';

export interface MongoValidatorInput {
  readonly jsonSchema: Record<string, unknown>;
  readonly validationLevel: MongoValidatorValidationLevel;
  readonly validationAction: MongoValidatorValidationAction;
}

/**
 * Mongo Contract IR node for collection-level document validators (the
 * `validator` field on Mongo's `createCollection`). Lifted from the
 * pre-M2R2 `MongoStorageValidator` storage interface to a class extending
 * `IRNodeBase` per FR18.
 *
 * Concrete at the family layer (no target subclass). The spec's
 * abstract-family + target-concrete pattern (`MongoTargetValidator
 * extends MongoValidator`) becomes meaningful when a second Mongo target
 * introduces target-specific validator extensions (Atlas search rules,
 * DocumentDB-specific levels, …); for the single Mongo target shipped
 * today, a concrete family-layer class lets the PSL JSON-Schema deriver
 * and the contract-ts builder construct instances directly without a
 * target-import layering violation. Target subclassing remains additive
 * — a future `MongoTargetValidator extends MongoValidator` is an
 * additive change, not a breaking one.
 */
export class MongoValidator extends IRNodeBase {
  readonly kind = 'mongo-validator' as const;
  readonly jsonSchema: Record<string, unknown>;
  readonly validationLevel: MongoValidatorValidationLevel;
  readonly validationAction: MongoValidatorValidationAction;

  constructor(input: MongoValidatorInput) {
    super();
    this.jsonSchema = input.jsonSchema;
    this.validationLevel = input.validationLevel;
    this.validationAction = input.validationAction;
    freezeNode(this);
  }
}
