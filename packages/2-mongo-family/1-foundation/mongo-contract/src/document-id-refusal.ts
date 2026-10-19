import type { ContractField } from '@internal/contract/types';

export interface DocumentIdRefusal {
  readonly problem: 'list' | 'nullable';
  readonly reason: string;
}

/**
 * Why a root model's field stored as `_id` cannot be, or undefined when it can. An `_id` may have any BSON type a validator can name, which the field rule checks, but it cannot be a list, which MongoDB refuses, or nullable, since every document has one. The reason leaves out its subject so each authoring surface can lead with its own, as in `Model "User" field "_id" holds the document id as ...`.
 */
export function documentIdRefusalOf(field: ContractField): DocumentIdRefusal | undefined {
  if (field.many) {
    return {
      problem: 'list',
      reason: 'holds the document id as a list, but MongoDB does not accept an array as an _id.',
    };
  }
  if (field.nullable) {
    return {
      problem: 'nullable',
      reason: 'holds the document id as an optional value, but every document has an _id.',
    };
  }
  return undefined;
}
