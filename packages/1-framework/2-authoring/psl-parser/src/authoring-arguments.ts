import {
  type AuthoringArgumentDescriptor,
  type AuthoringOption,
  type AuthoringValueArgument,
  type DataTypeSupport,
  readWrittenValueAs,
} from '@internal/framework-components/authoring';
import { dataTypeId } from '@internal/framework-components/codec';
import type { PslSpan } from '@internal/framework-components/psl-ast';
import { InternalError } from '@internal/utils/internal-error';
import type { DiagnosticSource, PslDiagnosticCollector } from './diagnostic';
import { readExpressionAs } from './read-expression-as';
import { nodePslSpan, type ResolvedAttributeArg } from './resolve';
import type { SyntaxNode } from './syntax/red';

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

/** Why a written value is not one of the names an option takes, and, for a number that only one value argument takes, that argument. */
function misplacedOptionMessage(
  descriptors: readonly AuthoringArgumentDescriptor[],
  dataTypes: DataTypeSupport,
  option: AuthoringOption,
  optionName: string,
  written: string,
  argumentLabel: string,
): string {
  const refused = `${argumentLabel} is ${written}, but argument "${optionName}" takes one of these names, written without quotes: ${option.values.join(', ')}.`;
  if (!/^[+-]?\d/.test(written)) return refused;
  const takers = descriptors.flatMap((descriptor) =>
    descriptor.kind === 'value' &&
    descriptor.name !== undefined &&
    readWrittenValueAs(dataTypes, dataTypeId(descriptor.dataType), {
      kind: 'number',
      text: written,
    }).ok
      ? [descriptor.name]
      : [],
  );
  const [taker] = takers;
  return takers.length === 1 && taker !== undefined
    ? `${refused} Write ${taker} by name, as in ${taker}: ${written}.`
    : refused;
}

/** Where a reader of a call's arguments reports what it refuses: at the call, at an argument, or at a value whose data type refuses it. */
interface ArgumentRefusals {
  call(message: string): void;
  argument(span: PslSpan, message: string): void;
  value(node: SyntaxNode, failure: { readonly code: string; readonly message: string }): void;
}

interface ReadPslHelperArgsInput {
  readonly args: readonly ResolvedAttributeArg[];
  readonly descriptors: readonly AuthoringArgumentDescriptor[];
  /** The stack's data types, which a `value` argument is read as. ADR 254. */
  readonly dataTypes: DataTypeSupport;
}

interface MapPslHelperArgsInput extends ReadPslHelperArgsInput {
  readonly helperLabel: string;
  readonly span: PslSpan;
  readonly diagnostics: PslDiagnosticCollector;
  readonly source: DiagnosticSource;
  readonly entityLabel: string;
}

const SILENT_REFUSALS: ArgumentRefusals = {
  call: () => {},
  argument: () => {},
  value: () => {},
};

/**
 * The value of one argument as `descriptor` reads it: a `value` argument as a value of its data type, read from its expression as attribute arguments are, and any other kind from its text. A refusal is reported at the argument.
 */
function readPslHelperArgument(
  input: ReadPslHelperArgsInput,
  refusals: ArgumentRefusals,
  descriptor: AuthoringArgumentDescriptor,
  argument: ResolvedAttributeArg,
  argumentLabel: string,
): unknown | typeof INVALID_AUTHORING_ARGUMENT {
  const refuse = (message: string): typeof INVALID_AUTHORING_ARGUMENT => {
    refusals.argument(argument.span, message);
    return INVALID_AUTHORING_ARGUMENT;
  };

  if (descriptor.kind !== 'value') {
    const value = parsePslAuthoringArgumentText(descriptor, argument.value);
    if (value !== INVALID_AUTHORING_ARGUMENT) return value;
    return refuse(
      descriptor.kind === 'option' && descriptor.name !== undefined
        ? misplacedOptionMessage(
            input.descriptors,
            input.dataTypes,
            descriptor,
            descriptor.name,
            argument.value.trim(),
            argumentLabel,
          )
        : `cannot parse ${argumentLabel} for descriptor kind "${descriptor.kind}".`,
    );
  }

  const { expression } = argument;
  if (expression === undefined && argument.node !== undefined) {
    return refuse(`${argumentLabel} has no value.`);
  }
  if (expression === undefined) {
    throw new InternalError(
      `A call received ${argumentLabel} with no expression. A value argument is read from the expression a schema writes; a reader that builds a call must pass the arguments it parsed, or instantiate the constructor with values.`,
    );
  }
  const read = readExpressionAs(input.dataTypes, dataTypeId(descriptor.dataType), expression);
  if (read.ok) return read.value.value;
  refusals.value(expression.syntax, read.failure);
  return INVALID_AUTHORING_ARGUMENT;
}

function readPslHelperArgsReporting(
  input: ReadPslHelperArgsInput,
  refusals: ArgumentRefusals,
): readonly unknown[] | undefined {
  const mappedArgs: unknown[] = input.descriptors.map(() => undefined);

  const positionalArgs = input.args.filter((arg) => arg.kind === 'positional');
  const namedArgs = input.args.filter((arg) => arg.kind === 'named');

  if (positionalArgs.length > input.descriptors.length) {
    refusals.call(
      `accepts at most ${input.descriptors.length} argument(s), received ${positionalArgs.length}.`,
    );
    return undefined;
  }

  for (const [index, argument] of positionalArgs.entries()) {
    const descriptor = input.descriptors[index];
    if (!descriptor) {
      refusals.argument(argument.span, `does not define positional argument #${index + 1}.`);
      return undefined;
    }

    const value = readPslHelperArgument(
      input,
      refusals,
      descriptor,
      argument,
      `argument #${index + 1}`,
    );
    if (value === INVALID_AUTHORING_ARGUMENT) return undefined;
    mappedArgs[index] = value;
  }

  for (const argument of namedArgs) {
    const descriptorIndex = input.descriptors.findIndex(
      (descriptor) => descriptor.name === argument.name,
    );
    const descriptor = input.descriptors[descriptorIndex];
    if (descriptorIndex < 0 || descriptor === undefined) {
      refusals.argument(argument.span, `received unknown named argument "${argument.name}".`);
      return undefined;
    }

    if (mappedArgs[descriptorIndex] !== undefined) {
      refusals.argument(argument.span, `received duplicate value for argument "${argument.name}".`);
      return undefined;
    }

    const value = readPslHelperArgument(
      input,
      refusals,
      descriptor,
      argument,
      `named argument "${argument.name}"`,
    );
    if (value === INVALID_AUTHORING_ARGUMENT) return undefined;
    mappedArgs[descriptorIndex] = value;
  }

  return mappedArgs;
}

/**
 * The arguments of a type constructor or field preset call, positional and named, each read as its descriptor says. `undefined`, with a diagnostic pushed, when one cannot be read or does not match a descriptor.
 */
export function mapPslHelperArgs(input: MapPslHelperArgsInput): readonly unknown[] | undefined {
  const refused = (span: PslSpan, message: string) =>
    input.diagnostics.push({
      code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
      message: `${input.entityLabel} ${input.helperLabel} ${message}`,
      ...input.source.at(span),
    });
  return readPslHelperArgsReporting(input, {
    call: (message) => refused(input.span, message),
    argument: refused,
    value: (node, failure) =>
      input.diagnostics.push({
        code: failure.code,
        message: failure.message,
        ...input.source.at(nodePslSpan(node, input.source.sources)),
      }),
  });
}

/**
 * The arguments of a call read as {@link mapPslHelperArgs} reads them, without reporting what it refuses: `undefined` when the call does not read, which the reader that resolves the column reports.
 */
export function readPslHelperArgs(input: ReadPslHelperArgsInput): readonly unknown[] | undefined {
  return readPslHelperArgsReporting(input, SILENT_REFUSALS);
}
