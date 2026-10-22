import sqlFamilyPack from '@internal/family-sql/pack';
import {
  type ComposedAuthoringHelpers,
  createComposedAuthoringHelpers,
} from '@internal/sql-contract-ts/contract-builder';
import { createSqliteBuiltinCodecLookup } from '@internal/target-sqlite/codecs';
import sqlitePack from '@internal/target-sqlite/pack';

/**
 * The field builders of the `defineContract` callback for SQLite, without extensions: `field.column(type.DateTime())`.
 */
export const field: ComposedAuthoringHelpers<
  typeof sqlFamilyPack,
  typeof sqlitePack,
  undefined
>['field'] = createComposedAuthoringHelpers({
  family: sqlFamilyPack,
  target: sqlitePack,
  codecLookup: createSqliteBuiltinCodecLookup(),
}).field;
