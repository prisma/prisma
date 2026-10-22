import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import {
  resolveAuthoringTypeChoice,
  typeConstructorLookup,
} from '../src/shared/authoring-type-choice';
import {
  type AuthoringTypeConstructorDescriptor,
  type AuthoringTypeNamespace,
  collectScalarTypeConstructors,
  instantiateAuthoringTypeCall,
  validateAuthoringTypeChoiceParams,
} from '../src/shared/framework-authoring';

const precision = {
  kind: 'value',
  dataType: 'test/int',
  name: 'precision',
  optional: true,
} as const;

const namespace = {
  Moment: {
    kind: 'typeChoice',
    args: [
      { kind: 'option', name: 'value', values: ['date', 'text'], default: 'date', optional: true },
      {
        kind: 'option',
        name: 'column',
        values: ['wide', 'narrow'],
        default: 'wide',
        optional: true,
      },
      precision,
    ],
    choices: [
      { when: { value: 'date', column: 'wide' }, type: 'WideDate', defaults: { precision: 3 } },
      { when: { value: 'text', column: 'wide' }, type: 'WideText' },
      { when: { value: 'date', column: 'narrow' }, type: 'NarrowDate' },
    ],
  },
  WideDate: {
    kind: 'typeConstructor',
    args: [precision],
    output: { codecId: 'test/wide-date@1', typeParams: { precision: { kind: 'arg', index: 0 } } },
  },
  WideText: {
    kind: 'typeConstructor',
    args: [precision],
    output: { codecId: 'test/wide-text@1', typeParams: { precision: { kind: 'arg', index: 0 } } },
  },
  NarrowDate: {
    kind: 'typeConstructor',
    output: { codecId: 'test/narrow-date@1' },
  },
} as const satisfies AuthoringTypeNamespace;

const resolve = (args: readonly unknown[]) =>
  resolveAuthoringTypeChoice({
    helperPath: 'Moment',
    descriptor: namespace.Moment,
    args,
    constructorNamed: typeConstructorLookup(namespace),
  });

function refusal(args: readonly unknown[]) {
  try {
    resolve(args);
  } catch (error) {
    const { message, details } = error as { message: string; details: unknown };
    return { message, details };
  }
  throw new Error('expected a refusal');
}

describe('resolveAuthoringTypeChoice', () => {
  it('chooses the default row, with its parameter defaults, for a bare call', () => {
    expect(resolve([])).toEqual({
      type: 'WideDate',
      descriptor: namespace.WideDate,
      args: [3],
    });
  });

  it('reads option arguments by position', () => {
    expect(resolve(['text'])).toMatchObject({ type: 'WideText', args: [undefined] });
  });

  it('fills an option argument left out before a written one with its default', () => {
    expect(resolve([undefined, 'narrow'])).toMatchObject({ type: 'NarrowDate', args: [] });
  });

  it('passes a written argument on by name, over the row default', () => {
    expect(resolve(['date', undefined, 6])).toMatchObject({ type: 'WideDate', args: [6] });
  });

  it('refuses a value the option does not list, at that argument, naming its values', () => {
    expect(refusal(['bogus'])).toEqual({
      message: 'Argument "value" of Moment is bogus; write one of: date, text.',
      details: { helperPath: 'Moment', argumentIndex: 0 },
    });
  });

  it('refuses an unlisted combination at the argument that makes it invalid, naming what it accepts', () => {
    expect(refusal(['text', 'narrow'])).toEqual({
      message:
        'Argument "column" of Moment cannot be narrow when value is text; write one of: wide.',
      details: { helperPath: 'Moment', argumentIndex: 1 },
    });
  });

  it('refuses a passed-on argument the chosen type does not take', () => {
    expect(refusal([undefined, 'narrow', 6])).toEqual({
      message:
        'Argument "precision" of Moment does not apply to NarrowDate, the type that value: date, column: narrow chooses.',
      details: { helperPath: 'Moment', argumentIndex: 2 },
    });
  });
});

describe('a type choice in the type namespace', () => {
  it('instantiates to the column its chosen constructor makes', () => {
    expect(instantiateAuthoringTypeCall(namespace, 'Moment', ['text', undefined, 6])).toEqual({
      codecId: 'test/wide-text@1',
      typeParams: { precision: 6 },
    });
  });

  it('is a scalar, written bare as its default choice', () => {
    expect(collectScalarTypeConstructors(namespace).get('Moment')).toEqual({
      codecId: 'test/wide-date@1',
      typeParams: { precision: 3 },
    });
  });
});

describe('validateAuthoringTypeChoiceParams', () => {
  const paramsSchema = type({ 'precision?': 'number <= 6' });
  const check = (
    chosen: AuthoringTypeConstructorDescriptor,
    typeParams: Record<string, unknown>,
  ) => {
    try {
      validateAuthoringTypeChoiceParams(
        'Moment',
        namespace.Moment,
        chosen,
        typeParams,
        paramsSchema,
      );
    } catch (error) {
      const { message, details } = error as { message: string; details: unknown };
      return { message, details };
    }
    return undefined;
  };

  it('passes parameters the codec accepts', () => {
    expect(check(namespace.WideDate, { precision: 6 })).toBeUndefined();
  });

  it('names the argument of the choice a refused parameter came from', () => {
    expect(check(namespace.WideDate, { precision: 7 })).toEqual({
      message: expect.stringMatching(
        /^Argument "precision" of Moment is invalid: precision must be/,
      ),
      details: { helperPath: 'Moment', argumentIndex: 2 },
    });
  });

  it('names the type parameters when a refused parameter came from no argument', () => {
    const fixed: AuthoringTypeConstructorDescriptor = {
      kind: 'typeConstructor',
      output: { codecId: 'test/fixed@1', typeParams: { precision: 9 } },
    };
    expect(check(fixed, { precision: 9 })).toEqual({
      message: expect.stringMatching(
        /^The type parameters of Moment are invalid: precision must be/,
      ),
      details: { helperPath: 'Moment' },
    });
  });
});
