import { contractError } from './contract-errors';

export interface ParamSpec {
  readonly codecId?: string;
  readonly traits?: readonly string[];
  readonly nullable: boolean;
}

export interface ReturnSpec {
  readonly codecId: string;
  readonly nullable: boolean;
}

/**
 * What an operation attaches to: a concrete codec identity, a set of codec
 * traits the field's codec must carry, or list-typed (`many`) fields.
 *
 * Families refine this structurally — a family self spec may add its own
 * members (for example element-level trait gating on the list variant) as
 * long as every variant stays assignable to one here.
 */
export type SelfSpec =
  | { readonly codecId: string; readonly traits?: never; readonly many?: never }
  | { readonly traits: readonly string[]; readonly codecId?: never; readonly many?: never }
  | { readonly many: true; readonly codecId?: never; readonly traits?: never };

export interface OperationEntry {
  readonly self?: SelfSpec;
  readonly impl: (...args: never[]) => unknown;
}

export type OperationDescriptor<T extends OperationEntry = OperationEntry> = T;

export type OperationDescriptors<T extends OperationEntry = OperationEntry> = Readonly<
  Record<string, OperationDescriptor<T>>
>;

export interface OperationRegistry<T extends OperationEntry = OperationEntry> {
  register(name: string, descriptor: OperationDescriptor<T>): void;
  entries(): Readonly<Record<string, T>>;
}

export function createOperationRegistry<
  T extends OperationEntry = OperationEntry,
>(): OperationRegistry<T> {
  const operations: Record<string, T> = Object.create(null);

  return {
    register(name: string, descriptor: OperationDescriptor<T>) {
      if (name in operations) {
        throw contractError(
          'CONTRACT.PACK_CONTRIBUTION_INVALID',
          `Operation "${name}" is already registered`,
          { meta: { operation: name } },
        );
      }
      if (descriptor.self) {
        const hasCodecId = descriptor.self.codecId !== undefined;
        const hasTraits = descriptor.self.traits !== undefined && descriptor.self.traits.length > 0;
        const targetsMany = descriptor.self.many === true;
        if (!hasCodecId && !hasTraits && !targetsMany) {
          throw contractError(
            'CONTRACT.PACK_CONTRIBUTION_INVALID',
            `Operation "${name}" self has none of codecId, traits, or many`,
            { meta: { operation: name } },
          );
        }
        if (hasCodecId && hasTraits) {
          throw contractError(
            'CONTRACT.PACK_CONTRIBUTION_INVALID',
            `Operation "${name}" self has both codecId and traits`,
            { meta: { operation: name } },
          );
        }
      }
      operations[name] = descriptor;
    },
    entries() {
      return Object.freeze({ ...operations });
    },
  };
}
