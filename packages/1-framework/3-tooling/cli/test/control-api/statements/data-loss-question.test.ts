import { asNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { dataLossQuestion } from '../../../src/control-api/statements/plan-questions';
import { contractOf } from './statement-fixtures';

const origin = contractOf({ app: { models: { User: { fields: ['email'] } } } });
const destination = contractOf({ app: { models: { User: { fields: ['email'] } } } });
const drop = {
  operationIndex: 0,
  label: 'Drop column age from user',
  subject: { kind: 'storage', name: 'public.user.age' },
} as const;

describe('dataLossQuestion for data no model names', () => {
  it('says no model of a known origin contract stores it', () => {
    const question = dataLossQuestion(drop, {
      origin,
      destination,
      renames: [],
      originKnown: true,
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
      renames: [],
      originKnown: false,
    });

    expect(question.question).toBe(
      'Drop column age from user would lose the data in "public.user.age", named by its storage name because the origin contract is unknown; --delete loses that data.',
    );
  });
});

describe('dataLossQuestion verbs', () => {
  const unbound = asNamespaceId('app');
  const destinationWithoutNickname = contractOf({
    app: { models: { User: { fields: ['email'] } } },
  });
  const withNickname = contractOf({ app: { models: { User: { fields: ['email', 'nickname'] } } } });

  function questionFor(field: string, destination: typeof origin) {
    return dataLossQuestion(
      {
        operationIndex: 0,
        label: 'An operation',
        subject: { kind: 'field', namespaceId: unbound, model: 'User', field },
      },
      { origin: withNickname, destination, renames: [], originKnown: true },
    );
  }

  function verbsFor(field: string, destination: typeof origin) {
    return questionFor(field, destination).verbs;
  }

  it('offers rename for a field the destination no longer has', () => {
    expect(verbsFor('nickname', destinationWithoutNickname)).toEqual(['rename', 'delete']);
  });

  it('offers only delete for a field that keeps its name, such as one whose type changes', () => {
    expect(verbsFor('email', destinationWithoutNickname)).toEqual(['delete']);
  });

  it('offers only delete for a field a rename statement of the plan already renamed', () => {
    const destination = contractOf({ app: { models: { User: { fields: ['email', 'handle'] } } } });
    const question = dataLossQuestion(
      {
        operationIndex: 1,
        label: 'Recreate table User',
        subject: { kind: 'field', namespaceId: unbound, model: 'User', field: 'nickname' },
      },
      {
        origin: withNickname,
        destination,
        renames: [{ verb: 'rename', text: 'User.nickname:User.handle' }],
        originKnown: true,
      },
    );
    expect(question.verbs).toEqual(['delete']);
  });

  it('writes the rename form of a field with its model, as a field rename is written', () => {
    expect(questionFor('nickname', destinationWithoutNickname).forms).toEqual({
      rename: 'User.nickname:User.<new name>',
    });
  });
});

describe('dataLossQuestion for a field whose model the destination names differently', () => {
  const app = asNamespaceId('app');
  const profile = contractOf({ app: { models: { Profile: { fields: ['email', 'nickname'] } } } });
  const person = contractOf({ app: { models: { Person: { fields: ['email', 'alias'] } } } });
  const loss = {
    operationIndex: 0,
    label: 'Remove field nickname from collection profiles',
    subject: { kind: 'field', namespaceId: app, model: 'Profile', field: 'nickname' },
  } as const;

  it('offers only delete, and says to rename the model first', () => {
    const question = dataLossQuestion(loss, {
      origin: profile,
      destination: person,
      renames: [],
      originKnown: true,
    });
    expect({ verbs: question.verbs, question: question.question }).toEqual({
      verbs: ['delete'],
      question:
        'Remove field nickname from collection profiles would lose the values of field "Profile.nickname". The destination contract has no model "Profile"; to keep the values instead, also pass --rename Profile:<new model name>, naming the model that stores them now, and the question then offers to rename the field.',
    });
  });

  it('offers the field rename once the printed model rename is passed, and accepts it', () => {
    const question = dataLossQuestion(loss, {
      origin: profile,
      destination: person,
      renames: [{ verb: 'rename', text: 'Profile:Person' }],
      originKnown: true,
    });
    expect({
      subject: question.subject,
      verbs: question.verbs,
      forms: question.forms,
      accepted: question.validate('rename', 'Person.nickname:Person.alias'),
    }).toEqual({
      subject: 'Person.nickname',
      verbs: ['rename', 'delete'],
      forms: { rename: 'Person.nickname:Person.<new name>' },
      accepted: undefined,
    });
  });
});
