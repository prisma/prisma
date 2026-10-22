import { defineContract, field, index, model } from '@internal/mongo/contract-builder';

export function buildContract() {
  const fields = { id: field.objectId().mongo({ field: '_id' }), email: field.string() };
  return defineContract({
    models: {
      User: model('User', { collection: 'people', fields, indexes: [index({ email: 1 })] }),
      Admin: model('Admin', { collection: 'people', fields, indexes: [index({ email: 1 })] }),
    },
  });
}
