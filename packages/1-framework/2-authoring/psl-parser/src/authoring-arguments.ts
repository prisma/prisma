import type {
  AuthoringArgumentDescriptor,
  DataTypeSupport,
} from '@internal/framework-components/authoring';
import { dataTypeId } from '@internal/framework-components/codec';
import type { PslSpan } from '@internal/framework-components/psl-ast';
import { InternalError } from '@internal/utils/internal-error';
import type { DiagnosticSource, PslDiagnosticCollector } from './diagnostic';
import { readExpressionAs } from './read-expression-as';
import { nodePslSpan, type ResolvedAttributeArg } from './resolve';

const INVALID_AUTHORING_ARGUMENT = Symbol('invalidAuthoringArgument');

function pushInvalidPslHelperArgument(input: {
  readonly diagnostics: PslDiagnosticCollector;
  readonly source: DiagnosticSource;
  readonly span: PslSpan;
  readonly entityLabel: string;
  readonly helperLabel: string;
  readonly message: string;
}): undefined {
  input.diagnostics.push({
    code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
    message: `${input.entityLabel} ${input.helperLabel} ${input.message}`,
    ...input.source.at(input.span),
  });
  return undefined;
}

interface MapPslHelperArgsInput {
  readonly args: readonly ResolvedAttributeArg[];
  readonly descriptors: readonly AuthoringArgumentDescriptor[];
  readonly helperLabel: string;
  readonly span: PslSpan;
  readonly diagnostics: PslDiagnosticCollector;
  readonly source: DiagnosticSource;
  readonly entityLabel: string;
  /** The stack's data types, which a `value` argument is read as. ADR 254. */
  readonly dataTypes: DataTypeSupport;
}

/**
 * The value of one argument as a value of its descriptor's data type, read from its expression as attribute arguments are. A refusal is pushed as a diagnostic at the argument.
 */
function readPslHelperArgument(
  input: MapPslHelperArgsInput,
  descriptor: AuthoringArgumentDescriptor,
  argument: ResolvedAttributeArg,
  argumentLabel: string,
): unknown | typeof INVALID_AUTHORING_ARGUMENT {
  const { expression } = argument;
  if (expression === undefined && argument.node !== undefined) {
    pushInvalidPslHelperArgument({
      diagnostics: input.diagnostics,
      source: input.source,
      span: argument.span,
      entityLabel: input.entityLabel,
      helperLabel: input.helperLabel,
      message: `${argumentLabel} has no value.`,
    });
    return INVALID_AUTHORING_ARGUMENT;
  }
  if (expression === undefined) {
    throw new InternalError(
      `${input.entityLabel} ${input.helperLabel} received ${argumentLabel} with no expression. A value argument is read from the expression a schema writes; a reader that builds a call must pass the arguments it parsed, or instantiate the constructor with values.`,
    );
  }
  const read = readExpressionAs(input.dataTypes, dataTypeId(descriptor.dataType), expression);
  if (read.ok) return read.value.value;
  input.diagnostics.push({
    code: read.failure.code,
    message: read.failure.message,
    ...input.source.at(nodePslSpan(expression.syntax, input.source.sources)),
  });
  return INVALID_AUTHORING_ARGUMENT;
}

/**
 * The arguments of a type constructor call, positional and named, each read as its descriptor says. `undefined`, with a diagnostic pushed, when one cannot be read or does not match a descriptor.
 */
export function mapPslHelperArgs(input: MapPslHelperArgsInput): readonly unknown[] | undefined {
  const mappedArgs: unknown[] = input.descriptors.map(() => undefined);

  const positionalArgs = input.args.filter((arg) => arg.kind === 'positional');
  const namedArgs = input.args.filter((arg) => arg.kind === 'named');

  if (positionalArgs.length > input.descriptors.length) {
    return pushInvalidPslHelperArgument({
      diagnostics: input.diagnostics,
      source: input.source,
      span: input.span,
      entityLabel: input.entityLabel,
      helperLabel: input.helperLabel,
      message: `accepts at most ${input.descriptors.length} argument(s), received ${positionalArgs.length}.`,
    });
  }

  for (const [index, argument] of positionalArgs.entries()) {
    const descriptor = input.descriptors[index];
    if (!descriptor) {
      return pushInvalidPslHelperArgument({
        diagnostics: input.diagnostics,
        source: input.source,
        span: argument.span,
        entityLabel: input.entityLabel,
        helperLabel: input.helperLabel,
        message: `does not define positional argument #${index + 1}.`,
      });
    }

    const value = readPslHelperArgument(input, descriptor, argument, `argument #${index + 1}`);
    if (value === INVALID_AUTHORING_ARGUMENT) return undefined;
    mappedArgs[index] = value;
  }

  for (const argument of namedArgs) {
    const descriptorIndex = input.descriptors.findIndex(
      (descriptor) => descriptor.name === argument.name,
    );
    if (descriptorIndex < 0) {
      return pushInvalidPslHelperArgument({
        diagnostics: input.diagnostics,
        source: input.source,
        span: argument.span,
        entityLabel: input.entityLabel,
        helperLabel: input.helperLabel,
        message: `received unknown named argument "${argument.name}".`,
      });
    }

    if (mappedArgs[descriptorIndex] !== undefined) {
      return pushInvalidPslHelperArgument({
        diagnostics: input.diagnostics,
        source: input.source,
        span: argument.span,
        entityLabel: input.entityLabel,
        helperLabel: input.helperLabel,
        message: `received duplicate value for argument "${argument.name}".`,
      });
    }

    const descriptor = input.descriptors[descriptorIndex];
    if (!descriptor) {
      return pushInvalidPslHelperArgument({
        diagnostics: input.diagnostics,
        source: input.source,
        span: argument.span,
        entityLabel: input.entityLabel,
        helperLabel: input.helperLabel,
        message: `does not define named argument "${argument.name}".`,
      });
    }

    const value = readPslHelperArgument(
      input,
      descriptor,
      argument,
      `named argument "${argument.name}"`,
    );
    if (value === INVALID_AUTHORING_ARGUMENT) return undefined;
    mappedArgs[descriptorIndex] = value;
  }

  return mappedArgs;
}
