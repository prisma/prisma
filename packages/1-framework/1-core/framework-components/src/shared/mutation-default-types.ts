import type {
  ColumnDefault,
  ExecutionMutationDefaultPhases,
  ExecutionMutationDefaultValue,
} from '@internal/contract/types';
import type { DataTypeId } from './data-type';

interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface SourceDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly sourceId: string;
  readonly span?: SourceSpan;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface DefaultFunctionLoweringContext {
  readonly sourceId: string;
  readonly modelName: string;
  readonly fieldName: string;
  readonly columnCodecId?: string;
}

export type LoweredDefaultValue =
  | { readonly kind: 'storage'; readonly defaultValue: ColumnDefault }
  | { readonly kind: 'execution'; readonly generated: ExecutionMutationDefaultValue };

export type LoweredDefaultResult =
  | { readonly ok: true; readonly value: LoweredDefaultValue }
  | { readonly ok: false; readonly diagnostic: SourceDiagnostic };

export interface MutationDefaultGeneratorDescriptor {
  readonly id: string;
  /**
   * The data types of the columns `@default(...)` may fill with this generator; a column qualifies when its codec's data type is listed, whichever codec it uses. Omitted for a generator reachable only through a field preset that also chooses the column's codec.
   */
  readonly applicableDataTypes?: readonly DataTypeId[];
  /** The generator writes text, so it also applies to every one of the stack's text data types (the assembled `textDataTypes`). */
  readonly writesText?: boolean;
  /** The number of characters the generator writes under its params, so a column too short for the value refuses it. Omitted when the length is not fixed. */
  readonly writtenLength?: (params: Readonly<Record<string, unknown>> | undefined) => number;
  /**
   * Construct the `onCreate`/`onUpdate` phases value owned by this
   * generator. Authoring layers (PSL `temporal.updatedAt()`, TS field presets) call
   * this instead of building the literal inline so PSL/TS-authored
   * contracts stay byte-equivalent for any future params-bearing generator.
   */
  readonly buildPhases?: (args?: Record<string, unknown>) => ExecutionMutationDefaultPhases;
}

// A default-function call whose arguments the function's `funcCall` signature has already parsed
// and validated, so the registry lowering reads them directly instead of re-parsing source text.
export interface TypedDefaultFunctionCall {
  readonly fn: string;
  readonly span: SourceSpan;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface ControlMutationDefaultEntry {
  // The function's argument signature, or a function that builds it from the stack's data types.
  // Typed `unknown` because its concrete type lives in the authoring layer, which the core
  // framework cannot import; the family that registers the entry narrows it back.
  readonly signature?: unknown;
  readonly lower: (input: {
    readonly call: TypedDefaultFunctionCall;
    readonly context: DefaultFunctionLoweringContext;
  }) => LoweredDefaultResult;
  readonly usageSignatures?: readonly string[];
  /**
   * The reverse of `lower`: for each generator id the function lowers to, the arguments of the PSL call that produces it, written from the generator's params. `contract print` writes `<function name>(<arguments>)`; a function without it is never printed.
   */
  readonly printArguments?: Readonly<Record<string, DefaultFunctionArgumentsPrinter>>;
}

export type DefaultFunctionArgumentsPrinter = (
  params: Readonly<Record<string, unknown>> | undefined,
) => string;

export type ControlMutationDefaultRegistry = ReadonlyMap<string, ControlMutationDefaultEntry>;

export interface ControlMutationDefaults {
  readonly defaultFunctionRegistry: ControlMutationDefaultRegistry;
  readonly generatorDescriptors: readonly MutationDefaultGeneratorDescriptor[];
}

/** The default function whose PSL call produces a generator. */
export interface DefaultFunctionPrinter {
  readonly functionName: string;
  readonly printArguments: DefaultFunctionArgumentsPrinter;
}

/** The mutation defaults of a composed stack, with the default function that writes each generator. */
export interface AssembledControlMutationDefaults extends ControlMutationDefaults {
  readonly defaultFunctionPrintersByGenerator: ReadonlyMap<string, DefaultFunctionPrinter>;
  /** For each registered generator id, the id of the component that registers it, or `undefined` when that component has no id. */
  readonly componentIdsByGenerator: ReadonlyMap<string, string | undefined>;
}
