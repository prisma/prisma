import mongoFamily from '@internal/family-mongo/pack';
import {
  defineContract,
  field,
  model,
  valueObject,
} from '@internal/mongo-contract-ts/contract-builder';
import mongoTarget from '@internal/target-mongo/pack';

const CompositeA = valueObject('CompositeA', {
  fields: {
    a1: field.string(),
    a_2: field.int32().optional(),
    a_to_one_b: field.valueObject('CompositeB').optional(),
    a_to_many_bs: field.valueObject('CompositeB').many(),
  },
});

const CompositeB = valueObject('CompositeB', {
  fields: {
    b_field: field.int32().optional(),
    b_to_one_c: field.valueObject('CompositeC').optional(),
    b_to_many_cs: field.valueObject('CompositeC').many(),
  },
});

const CompositeC = valueObject('CompositeC', {
  fields: {
    c_field: field.int32(),
    c_to_many_as: field.valueObject('CompositeA').many(),
  },
});

const TestModel = model('TestModel', {
  collection: 'TestModel',
  fields: {
    _id: field.int32(),
    field: field.string().optional(),
    top_a: field.valueObject(CompositeA).many(),
    to_one_b: field.valueObject(CompositeB).optional(),
  },
});

export const contract = defineContract({
  family: mongoFamily,
  target: mongoTarget,
  models: { TestModel },
  valueObjects: { CompositeA, CompositeB, CompositeC },
});
