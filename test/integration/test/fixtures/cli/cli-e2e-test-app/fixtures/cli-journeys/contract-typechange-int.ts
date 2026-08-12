import { int4Column, textColumn } from '@internal/adapter-postgres/column-types';
import { defineContract, field, model } from '@internal/postgres/contract-builder';

/**
 * Type-change *to*-state: the `score` column, previously `text`
 * (`contract-typechange-text.ts`), is retyped as `int4`. The
 * `text → int4` transition is unsafe (not in `SAFE_WIDENINGS`), so the
 * Postgres `typeChangeCallStrategy` emits
 * `dataTransform(placeholder slots) → alterColumnType` and the user must
 * fill in the placeholders with a normalising query.
 */
export const contract = defineContract({
  models: {
    User: model('User', {
      fields: {
        id: field.column(int4Column).id(),
        email: field.column(textColumn),
        score: field.column(int4Column),
      },
    }).sql({ table: 'user' }),
  },
});
