import type {
  AuthoringArgumentDescriptor,
  AuthoringValueArgument,
  DataTypeSupport,
} from '@internal/framework-components/authoring';
import { dataTypeId } from '@internal/framework-components/codec';
import type { PslSpan } from '@internal/framework-components/psl-ast';
import { InternalError } from '@internal/utils/internal-error';
import type { DiagnosticSource, PslDiagnosticCollector } from './diagnostic';
import { readExpressionAs } from './read-expression-as';
import { nodePslSpan, type ResolvedAttributeArg } from './resolve';

function unquoteStringLiteral(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(['"])(.*)\1$/);
  if (!match) {
    return trimmed;
  }
  return match[2] ?? '';
}

const INVALID_AUTHORING_ARGUMENT = Symbol('invalidAuthoringArgument');

type ParsedPslLiteral =
  | string
  | number
  | boolean
  | null
  | ParsedPslLiteral[]
  | { [key: string]: ParsedPslLiteral };

function isIdentifierStartCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_$]/.test(character);
}

function isIdentifierCharacter(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

function parseJsLikeLiteral(value: string): ParsedPslLiteral | typeof INVALID_AUTHORING_ARGUMENT {
  let index = 0;

  function skipWhitespace() {
    while (/\s/.test(value[index] ?? '')) {
      index += 1;
    }
  }

  function parseIdentifier(): string | typeof INVALID_AUTHORING_ARGUMENT {
    const first = value[index];
    if (!isIdentifierStartCharacter(first)) {
      return INVALID_AUTHORING_ARGUMENT;
    }

    let end = index + 1;
    while (isIdentifierCharacter(value[end])) {
      end += 1;
    }

    const identifier = value.slice(index, end);
    index = end;
    return identifier;
  }

  function parseString(): string | typeof INVALID_AUTHORING_ARGUMENT {
    const quote = value[index];
    if (quote !== '"' && quote !== "'") {
      return INVALID_AUTHORING_ARGUMENT;
    }

    index += 1;
    let result = '';

    while (index < value.length) {
      const character = value[index];
      index += 1;

      if (character === undefined) {
        return INVALID_AUTHORING_ARGUMENT;
      }

      if (character === quote) {
        return result;
      }

      if (character !== '\\') {
        result += character;
        continue;
      }

      const escaped = value[index];
      index += 1;

      if (escaped === undefined) {
        return INVALID_AUTHORING_ARGUMENT;
      }

      switch (escaped) {
        case "'":
        case '"':
        case '\\':
        case '/':
          result += escaped;
          break;
        case 'b':
          result += '\b';
          break;
        case 'f':
          result += '\f';
          break;
        case 'n':
          result += '\n';
          break;
        case 'r':
          result += '\r';
          break;
        case 't':
          result += '\t';
          break;
        case 'u': {
          const hex = value.slice(index, index + 4);
          if (!/^[0-9A-Fa-f]{4}$/.test(hex)) {
            return INVALID_AUTHORING_ARGUMENT;
          }
          result += String.fromCharCode(Number.parseInt(hex, 16));
          index += 4;
          break;
        }
        default:
          return INVALID_AUTHORING_ARGUMENT;
      }
    }

    return INVALID_AUTHORING_ARGUMENT;
  }

  function parseNumber(): number | typeof INVALID_AUTHORING_ARGUMENT {
    const match = value.slice(index).match(/^[+-]?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    const raw = match?.[0];
    if (!raw) {
      return INVALID_AUTHORING_ARGUMENT;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return INVALID_AUTHORING_ARGUMENT;
    }

    index += raw.length;
    return parsed;
  }

  function parseArray(): ParsedPslLiteral[] | typeof INVALID_AUTHORING_ARGUMENT {
    if (value[index] !== '[') {
      return INVALID_AUTHORING_ARGUMENT;
    }

    index += 1;
    const result: ParsedPslLiteral[] = [];

    skipWhitespace();
    if (value[index] === ']') {
      index += 1;
      return result;
    }

    while (index < value.length) {
      const entry = parseValue();
      if (entry === INVALID_AUTHORING_ARGUMENT) {
        return INVALID_AUTHORING_ARGUMENT;
      }
      result.push(entry);

      skipWhitespace();
      if (value[index] === ',') {
        index += 1;
        skipWhitespace();
        continue;
      }
      if (value[index] === ']') {
        index += 1;
        return result;
      }
      return INVALID_AUTHORING_ARGUMENT;
    }

    return INVALID_AUTHORING_ARGUMENT;
  }

  function parseObject(): { [key: string]: ParsedPslLiteral } | typeof INVALID_AUTHORING_ARGUMENT {
    if (value[index] !== '{') {
      return INVALID_AUTHORING_ARGUMENT;
    }

    index += 1;
    const result: { [key: string]: ParsedPslLiteral } = {};

    skipWhitespace();
    if (value[index] === '}') {
      index += 1;
      return result;
    }

    while (index < value.length) {
      skipWhitespace();
      const key = value[index] === '"' || value[index] === "'" ? parseString() : parseIdentifier();
      if (key === INVALID_AUTHORING_ARGUMENT) {
        return INVALID_AUTHORING_ARGUMENT;
      }

      skipWhitespace();
      if (value[index] !== ':') {
        return INVALID_AUTHORING_ARGUMENT;
      }

      index += 1;
      const entry = parseValue();
      if (entry === INVALID_AUTHORING_ARGUMENT) {
        return INVALID_AUTHORING_ARGUMENT;
      }
      result[key] = entry;

      skipWhitespace();
      if (value[index] === ',') {
        index += 1;
        skipWhitespace();
        continue;
      }
      if (value[index] === '}') {
        index += 1;
        return result;
      }
      return INVALID_AUTHORING_ARGUMENT;
    }

    return INVALID_AUTHORING_ARGUMENT;
  }

  function parseValue(): ParsedPslLiteral | typeof INVALID_AUTHORING_ARGUMENT {
    skipWhitespace();
    const character = value[index];
    if (character === '{') {
      return parseObject();
    }
    if (character === '[') {
      return parseArray();
    }
    if (character === '"' || character === "'") {
      return parseString();
    }
    if (character === '-' || character === '+' || /\d/.test(character ?? '')) {
      return parseNumber();
    }

    const identifier = parseIdentifier();
    if (identifier === INVALID_AUTHORING_ARGUMENT) {
      return INVALID_AUTHORING_ARGUMENT;
    }
    if (identifier === 'true') {
      return true;
    }
    if (identifier === 'false') {
      return false;
    }
    if (identifier === 'null') {
      return null;
    }
    return INVALID_AUTHORING_ARGUMENT;
  }

  skipWhitespace();
  const parsed = parseValue();
  if (parsed === INVALID_AUTHORING_ARGUMENT) {
    return parsed;
  }

  skipWhitespace();
  return index === value.length ? parsed : INVALID_AUTHORING_ARGUMENT;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parsePslObjectLiteral(
  value: string,
): Record<string, unknown> | typeof INVALID_AUTHORING_ARGUMENT {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return INVALID_AUTHORING_ARGUMENT;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = parseJsLikeLiteral(trimmed);
    if (parsed === INVALID_AUTHORING_ARGUMENT) {
      return INVALID_AUTHORING_ARGUMENT;
    }
  }

  if (!isPlainObject(parsed)) {
    return INVALID_AUTHORING_ARGUMENT;
  }

  return parsed;
}

type TextArgumentDescriptor = Exclude<AuthoringArgumentDescriptor, AuthoringValueArgument>;

function parsePslAuthoringArgumentText(
  descriptor: TextArgumentDescriptor,
  rawValue: string,
): unknown | typeof INVALID_AUTHORING_ARGUMENT {
  switch (descriptor.kind) {
    case 'number': {
      const parsed = Number(unquoteStringLiteral(rawValue));
      return Number.isNaN(parsed) ? INVALID_AUTHORING_ARGUMENT : parsed;
    }
    case 'object':
      return parsePslObjectLiteral(rawValue);
    case 'option': {
      const trimmed = rawValue.trim();
      return /^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed) ? trimmed : INVALID_AUTHORING_ARGUMENT;
    }
    default: {
      const _exhaustive: never = descriptor;
      void _exhaustive;
      return INVALID_AUTHORING_ARGUMENT;
    }
  }
}

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
 * The value of one argument as `descriptor` reads it: a `value` argument as a value of its data type, read from its expression as attribute arguments are, and any other kind from its text. A refusal is pushed as a diagnostic at the argument.
 */
function readPslHelperArgument(
  input: MapPslHelperArgsInput,
  descriptor: AuthoringArgumentDescriptor,
  argument: ResolvedAttributeArg,
  argumentLabel: string,
): unknown | typeof INVALID_AUTHORING_ARGUMENT {
  const invalid = (): typeof INVALID_AUTHORING_ARGUMENT => {
    pushInvalidPslHelperArgument({
      diagnostics: input.diagnostics,
      source: input.source,
      span: argument.span,
      entityLabel: input.entityLabel,
      helperLabel: input.helperLabel,
      message:
        descriptor.kind === 'option' && descriptor.name !== undefined
          ? `cannot parse ${argumentLabel}: ${argumentLabel} is ${argument.value.trim()}, but argument "${descriptor.name}" takes one of these names, written without quotes: ${descriptor.values.join(', ')}.`
          : `cannot parse ${argumentLabel} for descriptor kind "${descriptor.kind}".`,
    });
    return INVALID_AUTHORING_ARGUMENT;
  };

  if (descriptor.kind !== 'value') {
    const value = parsePslAuthoringArgumentText(descriptor, argument.value);
    return value === INVALID_AUTHORING_ARGUMENT ? invalid() : value;
  }

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
 * The arguments of a type constructor or field preset call, positional and named, each read as its descriptor says. `undefined`, with a diagnostic pushed, when one cannot be read or does not match a descriptor.
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
