export interface IndexDef {
  readonly columns: readonly string[];
  readonly name?: string;
  readonly type?: string;
  readonly options?: Record<string, unknown>;
}

export interface ForeignKeyDefaultsState {
  readonly constraint: boolean;
  readonly index: boolean;
}
