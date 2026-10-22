import { describe, expect, it } from 'vitest';
import type { CreateControlStackInput } from '../src/control/control-stack';
import { createControlStack } from '../src/control/control-stack';
import {
  type AuthoringTypeChoiceDescriptor,
  assertTypeChoicesValid,
} from '../src/shared/authoring-type-choice';
import type { AuthoringTypeNamespace } from '../src/shared/framework-authoring';

const precision = {
  kind: 'value',
  dataType: 'test/int',
  name: 'precision',
  optional: true,
} as const;

const valueOption = {
  kind: 'option',
  name: 'value',
  values: ['date', 'text'],
  default: 'date',
  optional: true,
} as const;

const choice = (overrides: Partial<AuthoringTypeChoiceDescriptor> = {}) =>
  ({
    kind: 'typeChoice',
    args: [valueOption, precision],
    choices: [
      { when: { value: 'date' }, type: 'WideDate', defaults: { precision: 3 } },
      { when: { value: 'text' }, type: 'WideText' },
    ],
    ...overrides,
  }) satisfies AuthoringTypeChoiceDescriptor;

const constructors = {
  WideDate: {
    kind: 'typeConstructor',
    args: [precision],
    output: { codecId: 'test/wide-date@1', typeParams: { precision: { kind: 'arg', index: 0 } } },
  },
  WideText: { kind: 'typeConstructor', output: { codecId: 'test/wide-text@1' } },
} as const satisfies AuthoringTypeNamespace;

const check = (moment: AuthoringTypeChoiceDescriptor, assembled: AuthoringTypeNamespace = {}) => {
  const contributed = { Moment: moment };
  return () =>
    assertTypeChoicesValid(contributed, 'x-pack', {
      ...constructors,
      ...contributed,
      ...assembled,
    });
};

describe('assertTypeChoicesValid', () => {
  it('passes a choice whose rows name constructors of its namespace', () => {
    expect(check(choice())).not.toThrow();
  });

  it('passes a choice naming a constructor another component registers', () => {
    const contributed = { Moment: choice() };
    expect(() =>
      assertTypeChoicesValid(contributed, 'x-pack', { ...contributed, ...constructors }),
    ).not.toThrow();
  });

  it('refuses a row naming a constructor no component registers, naming the pack and the name', () => {
    expect(check(choice({ choices: [{ when: { value: 'date' }, type: 'Missing' }] }))).toThrow(
      'Type choice "Moment" contributed by "x-pack" chooses "Missing", which is not a type constructor any component registers beside it.',
    );
  });

  it('refuses a default no row matches', () => {
    expect(check(choice({ choices: [{ when: { value: 'text' }, type: 'WideText' }] }))).toThrow(
      'Type choice "Moment" contributed by "x-pack" has no row for its defaults value: date, so it cannot be written bare.',
    );
  });

  it('refuses a default the option does not list', () => {
    expect(
      check(
        choice({
          args: [
            { kind: 'option', name: 'value', values: ['text'], default: 'date', optional: true },
          ],
        }),
      ),
    ).toThrow(
      'Type choice "Moment" contributed by "x-pack" defaults option "value" to date, which it does not list.',
    );
  });

  it('refuses a row whose combination names a value an option does not list', () => {
    expect(
      check(
        choice({
          choices: [
            { when: { value: 'date' }, type: 'WideDate' },
            { when: { value: 'json' }, type: 'WideText' },
          ],
        }),
      ),
    ).toThrow(
      'Type choice "Moment" contributed by "x-pack" has a row for value: json, which does not give every option one of its values.',
    );
  });

  it('refuses a parameter default for an argument the choice does not pass on', () => {
    expect(
      check(
        choice({
          choices: [
            { when: { value: 'date' }, type: 'WideDate', defaults: { scale: 2 } },
            { when: { value: 'text' }, type: 'WideText' },
          ],
        }),
      ),
    ).toThrow(
      'Type choice "Moment" contributed by "x-pack" gives a default for "scale", which is not an argument it passes on.',
    );
  });

  it('refuses two rows for one combination', () => {
    expect(
      check(
        choice({
          choices: [
            { when: { value: 'date' }, type: 'WideDate' },
            { when: { value: 'text' }, type: 'WideText' },
            { when: { value: 'date' }, type: 'WideText' },
          ],
        }),
      ),
    ).toThrow(
      'Type choice "Moment" contributed by "x-pack" has two rows for value: date; each combination chooses one type.',
    );
  });

  it('refuses a parameter default the chosen constructor does not take', () => {
    expect(
      check(
        choice({
          choices: [
            { when: { value: 'date' }, type: 'WideDate' },
            { when: { value: 'text' }, type: 'WideText', defaults: { precision: 3 } },
          ],
        }),
      ),
    ).toThrow(
      'Type choice "Moment" contributed by "x-pack" gives a default for "precision" to "WideText", which takes no argument of that name.',
    );
  });

  it('refuses a passed-on argument of another data type than the chosen constructor takes', () => {
    expect(check(choice({ args: [valueOption, { ...precision, dataType: 'test/text' }] }))).toThrow(
      'Type choice "Moment" contributed by "x-pack" passes "precision" as a value of data type "test/text" to "WideDate", which takes "test/int".',
    );
  });
});

describe('createControlStack', () => {
  it('refuses a type choice naming a constructor no component registers', () => {
    const input = {
      family: { kind: 'family', id: 'fam', version: '0.0.1' },
      target: {
        kind: 'target',
        id: 'tgt',
        version: '0.0.1',
        authoring: {
          type: { Moment: choice({ choices: [{ when: { value: 'date' }, type: 'Missing' }] }) },
        },
      },
      extensions: [],
    } as unknown as CreateControlStackInput;

    expect(() => createControlStack(input)).toThrow(/"Moment" contributed by "tgt".*"Missing"/);
  });
});
