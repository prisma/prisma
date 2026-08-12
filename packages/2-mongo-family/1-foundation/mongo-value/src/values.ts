import type { MongoParamRef } from './param-ref';

export type LiteralValue = string | number | boolean | null | Date;
export type MongoValue = MongoParamRef | LiteralValue | MongoDocument | MongoArray;
export interface MongoDocument {
  readonly [key: string]: MongoValue;
}
export interface MongoArray extends ReadonlyArray<MongoValue> {}
export type MongoExpr = MongoDocument;
export type MongoUpdateDocument = Record<string, MongoValue>;
export type RawPipeline = ReadonlyArray<Record<string, unknown>>;
export type Document = Record<string, unknown>;
