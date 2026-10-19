import type { ExecutionMutationDefaultValue } from '@internal/contract/types';
import { runtimeError } from './runtime-error';

export interface GeneratorFunctionColumn {
  readonly codecId: string;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
}

export type GeneratorResolution =
  | { readonly ok: true; readonly generator: ExecutionMutationDefaultValue }
  | { readonly ok: false; readonly message: string };

export interface GeneratorFunctionCallText {
  readonly args: Readonly<Record<string, unknown>>;
  readonly text: string;
}

export interface GeneratorFunctionBinding {
  readonly codecIds: readonly string[];
  /** Every generator id `resolve` can produce. */
  readonly generatorIds: readonly string[];
  readonly resolve: (input: {
    readonly args: Readonly<Record<string, unknown>>;
    readonly column: GeneratorFunctionColumn;
  }) => GeneratorResolution;
  /** The arguments that produce `generator` on `column`, or `undefined` when this binding never produces it. */
  readonly printArguments: (
    generator: ExecutionMutationDefaultValue,
    column: GeneratorFunctionColumn,
  ) => GeneratorFunctionCallText | undefined;
}

export interface GeneratorFunctionContribution {
  readonly name: string;
  /** A `FuncCallSig`, typed `unknown` as `ControlMutationDefaultEntry.signature` is. Exactly one contribution per name sets it. */
  readonly signature?: unknown;
  readonly bindings: readonly GeneratorFunctionBinding[];
}

export interface GeneratorFunctionSummary {
  readonly name: string;
  readonly signature: unknown;
}

export type GeneratorFunctionResolution =
  | { readonly ok: true; readonly generator: ExecutionMutationDefaultValue }
  | { readonly ok: false; readonly reason: 'refused'; readonly message: string }
  | {
      readonly ok: false;
      readonly reason: 'unknown-function' | 'not-bound';
      readonly boundCodecIds: readonly string[];
    };

export interface GeneratorFunctionCall extends GeneratorFunctionCallText {
  readonly name: string;
}

export interface GeneratorFunctionRegistry {
  functionsFor(codecId: string): readonly GeneratorFunctionSummary[];
  has(name: string): boolean;
  resolve(input: {
    readonly name: string;
    readonly args: Readonly<Record<string, unknown>>;
    readonly column: GeneratorFunctionColumn;
  }): GeneratorFunctionResolution;
  callFor(
    generator: ExecutionMutationDefaultValue,
    column: GeneratorFunctionColumn,
  ): GeneratorFunctionCall | undefined;
}

interface DeclaredFunction {
  readonly signature: unknown;
  readonly declaredBy: string;
}

interface OwnedBinding {
  readonly name: string;
  readonly binding: GeneratorFunctionBinding;
  readonly contributedBy: string;
}

function invalidContribution(message: string): Error {
  return runtimeError('CONTRACT.PACK_CONTRIBUTION_INVALID', message);
}

/**
 * Assemble the generator functions of a composed stack. The control stack passes the generator ids its components register as `registeredGeneratorIds`; the TypeScript builder, which has no generator descriptors, omits it.
 */
export function assembleGeneratorFunctions(
  descriptors: ReadonlyArray<{
    readonly id?: string;
    readonly generatorFunctions?: readonly GeneratorFunctionContribution[];
  }>,
  options?: { readonly registeredGeneratorIds?: ReadonlySet<string> | undefined },
): GeneratorFunctionRegistry {
  const declared = new Map<string, DeclaredFunction>();
  const bindingsByCodec = new Map<string, Map<string, OwnedBinding>>();
  const printersByCodecAndGenerator = new Map<string, OwnedBinding>();
  const contributed: OwnedBinding[] = [];

  for (const descriptor of descriptors) {
    const contributedBy = descriptor.id ?? '<unknown>';
    for (const contribution of descriptor.generatorFunctions ?? []) {
      if (contribution.signature !== undefined) {
        const existing = declared.get(contribution.name);
        if (existing !== undefined) {
          throw invalidContribution(
            `Generator function "${contribution.name}" is declared by both "${existing.declaredBy}" and "${contributedBy}".`,
          );
        }
        declared.set(contribution.name, {
          signature: contribution.signature,
          declaredBy: contributedBy,
        });
      }
      for (const binding of contribution.bindings) {
        contributed.push({ name: contribution.name, binding, contributedBy });
      }
    }
  }

  for (const owned of contributed) {
    if (!declared.has(owned.name)) {
      throw invalidContribution(
        `"${owned.contributedBy}" binds generator function "${owned.name}", which no component declares.`,
      );
    }
    for (const codecId of owned.binding.codecIds) {
      const forCodec = bindingsByCodec.get(codecId) ?? new Map<string, OwnedBinding>();
      const existing = forCodec.get(owned.name);
      if (existing !== undefined) {
        throw invalidContribution(
          `Generator function "${owned.name}" is bound to codec "${codecId}" by both "${existing.contributedBy}" and "${owned.contributedBy}".`,
        );
      }
      forCodec.set(owned.name, owned);
      bindingsByCodec.set(codecId, forCodec);

      for (const generatorId of owned.binding.generatorIds) {
        const key = `${codecId}\u0000${generatorId}`;
        const printer = printersByCodecAndGenerator.get(key);
        if (printer !== undefined && printer.name !== owned.name) {
          throw invalidContribution(
            `Generator "${generatorId}" on codec "${codecId}" is written by both function "${printer.name}" from "${printer.contributedBy}" and function "${owned.name}" from "${owned.contributedBy}".`,
          );
        }
        printersByCodecAndGenerator.set(key, owned);
      }
    }
    const registered = options?.registeredGeneratorIds;
    if (registered !== undefined) {
      for (const generatorId of owned.binding.generatorIds) {
        if (!registered.has(generatorId)) {
          throw invalidContribution(
            `Generator function "${owned.name}" from "${owned.contributedBy}" produces generator "${generatorId}", which no generator descriptor in the stack registers.`,
          );
        }
      }
    }
  }

  function boundCodecIdsOf(name: string): readonly string[] {
    return [...bindingsByCodec.entries()]
      .filter(([, forCodec]) => forCodec.has(name))
      .map(([codecId]) => codecId)
      .sort();
  }

  return {
    functionsFor(codecId) {
      return [...(bindingsByCodec.get(codecId)?.keys() ?? [])].sort().map((name) => ({
        name,
        signature: declared.get(name)?.signature,
      }));
    },
    has(name) {
      return declared.has(name);
    },
    resolve({ name, args, column }) {
      if (!declared.has(name)) {
        return { ok: false, reason: 'unknown-function', boundCodecIds: [] };
      }
      const owned = bindingsByCodec.get(column.codecId)?.get(name);
      if (owned === undefined) {
        return { ok: false, reason: 'not-bound', boundCodecIds: boundCodecIdsOf(name) };
      }
      const resolution = owned.binding.resolve({ args, column });
      return resolution.ok
        ? resolution
        : { ok: false, reason: 'refused', message: resolution.message };
    },
    callFor(generator, column) {
      const owned = printersByCodecAndGenerator.get(`${column.codecId}\u0000${generator.id}`);
      if (owned === undefined) return undefined;
      const printed = owned.binding.printArguments(generator, column);
      return printed === undefined ? undefined : { name: owned.name, ...printed };
    },
  };
}

/**
 * A binding of a function that takes no arguments to one generator, with params read from the column when `paramsFromColumn` gives any.
 */
export function singleGeneratorBinding(input: {
  readonly codecIds: readonly string[];
  readonly generatorId: string;
  readonly paramsFromColumn?: (
    column: GeneratorFunctionColumn,
  ) => Readonly<Record<string, unknown>> | undefined;
}): GeneratorFunctionBinding {
  return {
    codecIds: input.codecIds,
    generatorIds: [input.generatorId],
    resolve: ({ column }) => {
      const params = input.paramsFromColumn?.(column);
      return {
        ok: true,
        generator:
          params === undefined
            ? { kind: 'generator', id: input.generatorId }
            : { kind: 'generator', id: input.generatorId, params },
      };
    },
    printArguments: (generator) =>
      generator.id === input.generatorId ? { args: {}, text: '' } : undefined,
  };
}
