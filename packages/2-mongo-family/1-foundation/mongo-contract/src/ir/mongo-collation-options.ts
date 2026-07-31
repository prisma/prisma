import { freezeNode, IRNodeBase } from '@internal/framework-components/ir';

export type MongoCollationCaseFirst = 'off' | 'upper' | 'lower';
export type MongoCollationStrength = 1 | 2 | 3 | 4 | 5;
export type MongoCollationAlternate = 'non-ignorable' | 'shifted';
export type MongoCollationMaxVariable = 'punct' | 'space';

/**
 * Authoring / hydration input shape for {@link MongoCollationOptions}. Carries
 * the canonical data without the IR-class `kind` discriminator; the class
 * fabricates `kind` so the authoring DSL and the SPI hydration walker can
 * pass plain data literals through the constructor without forcing every
 * call site to spell out `kind: 'mongo-collation-options'`.
 */
export interface MongoCollationOptionsInput {
  readonly locale: string;
  readonly caseLevel?: boolean;
  readonly caseFirst?: MongoCollationCaseFirst;
  readonly strength?: MongoCollationStrength;
  readonly numericOrdering?: boolean;
  readonly alternate?: MongoCollationAlternate;
  readonly maxVariable?: MongoCollationMaxVariable;
  readonly backwards?: boolean;
  readonly normalization?: boolean;
}

/**
 * Mongo Contract IR leaf for collection / index collation options.
 *
 * Lifted from a `type =` data shape to an AST class extending
 * `IRNodeBase` per FR18 ("Mongo's Contract IR is fully unified under
 * the AST-class pattern, layered family / target"). Single concrete class
 * (no target subclass): collation options carry no target-specific
 * variation at this layer — both Atlas and self-hosted Mongo consume the
 * same option vocabulary.
 *
 * Undefined optional fields are not assigned, so `JSON.stringify` omits
 * them from the canonical JSON output (matches the pre-lift data shape's
 * round-trip behaviour, modulo the new `kind` discriminator).
 */
export class MongoCollationOptions extends IRNodeBase {
  readonly kind = 'mongo-collation-options' as const;
  readonly locale: string;
  declare readonly caseLevel?: boolean;
  declare readonly caseFirst?: MongoCollationCaseFirst;
  declare readonly strength?: MongoCollationStrength;
  declare readonly numericOrdering?: boolean;
  declare readonly alternate?: MongoCollationAlternate;
  declare readonly maxVariable?: MongoCollationMaxVariable;
  declare readonly backwards?: boolean;
  declare readonly normalization?: boolean;

  constructor(options: MongoCollationOptionsInput) {
    super();
    this.locale = options.locale;
    if (options.caseLevel !== undefined) this.caseLevel = options.caseLevel;
    if (options.caseFirst !== undefined) this.caseFirst = options.caseFirst;
    if (options.strength !== undefined) this.strength = options.strength;
    if (options.numericOrdering !== undefined) this.numericOrdering = options.numericOrdering;
    if (options.alternate !== undefined) this.alternate = options.alternate;
    if (options.maxVariable !== undefined) this.maxVariable = options.maxVariable;
    if (options.backwards !== undefined) this.backwards = options.backwards;
    if (options.normalization !== undefined) this.normalization = options.normalization;
    freezeNode(this);
  }
}
