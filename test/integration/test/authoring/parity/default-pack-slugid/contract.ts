import { defineContract, field, model } from '@internal/postgres/contract-builder';

export const contract = defineContract({
  models: {
    User: model('User', {
      fields: {
        id: field
          .generated({
            type: { codecId: 'pg/text@1', nativeType: 'text' },
            generated: { kind: 'generator', id: 'slugid' },
          })
          .id(),
      },
    }).sql({ table: 'user' }),
  },
});
