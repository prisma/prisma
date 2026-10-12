import { asNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  consentDescription,
  dataLossQuestion,
} from '../../../src/control-api/statements/plan-questions';
import { contractOf } from './statement-fixtures';

const origin = contractOf({ app: { models: { User: { fields: ['email'] } } } });
const destination = contractOf({ app: { models: { User: { fields: ['email'] } } } });
const drop = {
  operationIndex: 0,
  label: 'Drop column age from user',
  subject: { kind: 'storage', name: 'public.user.age' },
  loss: 'drop',
} as const;

describe('dataLossQuestion for data no model names', () => {
  it('says no model of a known origin contract stores it', () => {
    const question = dataLossQuestion(drop, {
      origin,
      destination,
      statements: [],
      canConvert: true,
      originKnown: true,
      keepDataByHand: undefined,
    });

    expect({ question: question.question, verbs: question.verbs }).toEqual({
      question:
        'Drop column age from user would lose the data in "public.user.age", which no model of the origin contract stores.',
      verbs: ['delete'],
    });
  });

  it('says the name is a storage name when the origin contract is unknown', () => {
    const question = dataLossQuestion(drop, {
      origin,
      destination,
      statements: [],
      canConvert: true,
      originKnown: false,
      keepDataByHand: undefined,
    });

    expect(question.question).toBe(
      'Drop column age from user would lose the data in "public.user.age", named by its storage name because the origin contract is unknown; --delete loses its rows.',
    );
  });
});

describe('dataLossQuestion verbs', () => {
  const unbound = asNamespaceId('app');
  const destinationWithoutNickname = contractOf({
    app: { models: { User: { fields: ['email'] } } },
  });
  const withNickname = contractOf({ app: { models: { User: { fields: ['email', 'nickname'] } } } });

  const keepByHand = () => 'Rename it by hand first.';

  function questionFor(
    field: string,
    destination: typeof origin,
    keepDataByHand: (() => string) | undefined,
  ) {
    return dataLossQuestion(
      {
        operationIndex: 0,
        label: 'An operation',
        subject: { kind: 'field', namespaceId: unbound, model: 'User', field },
        loss: 'drop',
      },
      {
        origin: withNickname,
        destination,
        statements: [],
        canConvert: true,
        originKnown: true,
        keepDataByHand,
      },
    );
  }

  function verbsFor(field: string, destination: typeof origin, renamesPlannable: boolean) {
    return questionFor(field, destination, renamesPlannable ? undefined : keepByHand).verbs;
  }

  it('offers rename for a field the destination no longer has', () => {
    expect(verbsFor('nickname', destinationWithoutNickname, true)).toEqual(['rename', 'delete']);
  });

  it('offers only delete for a dropped field the destination still has', () => {
    expect(verbsFor('email', destinationWithoutNickname, true)).toEqual(['delete']);
  });

  it('offers only delete for a field a rename statement of the plan already renamed', () => {
    const destination = contractOf({ app: { models: { User: { fields: ['email', 'handle'] } } } });
    const question = dataLossQuestion(
      {
        operationIndex: 1,
        label: 'Recreate table User',
        subject: { kind: 'field', namespaceId: unbound, model: 'User', field: 'nickname' },
        loss: 'drop',
      },
      {
        origin: withNickname,
        destination,
        statements: [{ verb: 'rename', text: 'User.nickname:User.handle' }],
        canConvert: true,
        originKnown: true,
        keepDataByHand: undefined,
      },
    );
    expect(question.verbs).toEqual(['delete']);
  });

  it('offers only delete where the planner cannot carry out a rename, and says how to keep the data by hand', () => {
    const question = questionFor('nickname', destinationWithoutNickname, keepByHand);
    expect({ verbs: question.verbs, question: question.question }).toEqual({
      verbs: ['delete'],
      question:
        'An operation would lose the values of field "User.nickname". Rename it by hand first.',
    });
  });

  it('writes the rename form of a field with its model, as a field rename is written', () => {
    expect(questionFor('nickname', destinationWithoutNickname, undefined).forms).toEqual({
      rename: 'User.nickname:User.<new name>',
    });
  });
});

describe('dataLossQuestion for a type change', () => {
  const unbound = asNamespaceId('app');
  const int = { codecId: 'test/int@1' };
  const from = contractOf({ app: { models: { User: { fields: ['age'] } } } });
  const to = contractOf({
    app: { models: { User: { fields: ['age'], fieldTypes: { age: int } } } },
  });
  const renamedTo = contractOf({
    app: { models: { User: { fields: ['years'], fieldTypes: { years: int } } } },
  });
  const ageChange = {
    operationIndex: 0,
    label: 'Alter type of "User"."age" to int4',
    subject: { kind: 'field', namespaceId: unbound, model: 'User', field: 'age' },
    loss: 'typeChange',
  } as const;

  function question(
    canConvert: boolean,
    destination = to,
    statements: readonly { verb: 'rename'; text: string }[] = [],
  ) {
    return dataLossQuestion(ageChange, {
      origin: from,
      destination,
      statements,
      canConvert,
      originKnown: true,
      keepDataByHand: undefined,
    });
  }

  it('offers convert and delete where the command writes a migration to fill in', () => {
    const asked = question(true);
    expect({ verbs: asked.verbs, forms: asked.forms }).toEqual({
      verbs: ['convert', 'delete'],
      forms: { convert: 'User.age' },
    });
    expect(asked.validate('convert', 'User.age')).toBeUndefined();
  });

  it('offers only delete where the command has no migration to fill in', () => {
    expect(question(false).verbs).toEqual(['delete']);
  });

  it('names the field to convert as the destination names it after a rename', () => {
    const asked = question(true, renamedTo, [{ verb: 'rename', text: 'User.age:User.years' }]);
    expect({
      subject: asked.subject,
      forms: asked.forms,
      accepted: asked.validate('convert', 'User.years'),
      rejected: asked.validate('convert', 'User.age'),
    }).toEqual({
      subject: 'User.age',
      forms: { convert: 'User.years' },
      accepted: undefined,
      rejected:
        'convert names the field as the destination contract names it: --convert User.years.',
    });
  });
});

describe('consentDescription', () => {
  const age = {
    kind: 'field',
    namespaceId: asNamespaceId('app'),
    model: 'User',
    field: 'age',
  } as const;

  it('says a delete that answers a type change accepts the lossy change, not that it deletes the field', () => {
    expect([
      consentDescription('delete', age, 'User.age', 'typeChange'),
      consentDescription('delete', age, 'User.age', 'drop'),
    ]).toEqual(['accept lossy type change of field "User.age"', 'delete field "User.age"']);
  });
});
