export class MongoParamRef {
  readonly value: unknown;
  readonly name: string | undefined;
  readonly codecId: string | undefined;

  constructor(value: unknown, options?: { name?: string; codecId?: string }) {
    this.value = value;
    this.name = options?.name;
    this.codecId = options?.codecId;
    Object.freeze(this);
  }

  static of(value: unknown, options?: { name?: string; codecId?: string }): MongoParamRef {
    return new MongoParamRef(value, options);
  }
}
