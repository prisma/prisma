import type {
  CollectionMethodBody,
  CollectionMethodContribution,
  CollectionMethodModel,
  CollectionMethodRegistry,
  CollectionMethodsEntry,
} from '@internal/sql-relational-core/query-lane-context';
import { blindCast } from '@internal/utils/casts';
import type { Vector } from '../types/codec-types';
import { VECTOR_CODEC_ID } from './constants';

type VectorFieldNames<Fields> = {
  [Name in keyof Fields]: Fields[Name] extends { readonly many: object }
    ? never
    : Fields[Name] extends { readonly type: { readonly codecId: typeof VECTOR_CODEC_ID } }
      ? Name
      : never;
}[keyof Fields];

type VectorLength<Field> = Field extends {
  readonly type: { readonly typeParams: { readonly length: infer Length extends number } };
}
  ? Length
  : number;

type NearestMethodTable<Model extends CollectionMethodModel> = {
  readonly [Name in VectorFieldNames<Model['fields']> & string as `${Name}_nearest`]: readonly [
    vector: Vector<VectorLength<Model['fields'][Name & keyof Model['fields']]>>,
    maxDistance?: number,
  ];
};

/** One method for each vector field of a model, named `<field>_nearest`: the rows nearest to a vector by cosine distance, nearest first, optionally only those within `maxDistance`. */
export interface PgvectorNearestMethods extends CollectionMethodsEntry {
  readonly methods: NearestMethodTable<this['model']>;
}

declare module '@internal/sql-relational-core/query-lane-context' {
  interface CollectionMethodRegistry {
    readonly 'pgvector/nearest': PgvectorNearestMethods;
  }
}

interface Distance {
  asc(): unknown;
  lt(limit: number): unknown;
}

type VectorFields = Readonly<
  Record<string, { cosineDistance(vector: readonly number[]): Distance }>
>;

function vectorFields(model: unknown): VectorFields {
  return blindCast<VectorFields, 'a vector field of the ORM model accessor has cosineDistance'>(
    model,
  );
}

function nearestMethod(field: string): CollectionMethodBody {
  return (collection, ...args) => {
    const [vector, maxDistance] = blindCast<
      readonly [readonly number[], number | undefined],
      'the type half declares a vector and an optional distance'
    >(args);
    const ordered = collection.orderBy((model) =>
      vectorFields(model)[field]?.cosineDistance(vector).asc(),
    );
    return maxDistance === undefined
      ? ordered
      : ordered.where((model) =>
          vectorFields(model)[field]?.cosineDistance(vector).lt(maxDistance),
        );
  };
}

/** The run-time half of `PgvectorNearestMethods`. */
export const pgvectorNearestMethods: CollectionMethodContribution = {
  id: 'pgvector/nearest' satisfies keyof CollectionMethodRegistry,
  methodsFor: (model) =>
    Object.fromEntries(
      Object.entries(model.fields).flatMap(([name, field]) =>
        !field.many && field.type.kind === 'scalar' && field.type.codecId === VECTOR_CODEC_ID
          ? [[`${name}_nearest`, nearestMethod(name)]]
          : [],
      ),
    ),
};
