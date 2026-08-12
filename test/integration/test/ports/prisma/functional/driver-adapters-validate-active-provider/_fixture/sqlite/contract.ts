import { textColumn } from '@internal/adapter-sqlite/column-types';
import { defineContract, field, model } from '@internal/sqlite/contract-builder';

const User = model('User', {
  fields: {
    id: field.column(textColumn).id(),
  },
}).sql({ table: 'User' });

export const contract = defineContract({ models: { User } });
