export type DatabaseRunnerQueries = {
  insert: string
  update: string
  delete: string
}

export abstract class AbstractDatabaseRunner {
  #insertQuery: string
  #updateQuery: string
  #deleteQuery: string

  protected constructor(queries: DatabaseRunnerQueries) {
    this.#insertQuery = queries.insert
    this.#updateQuery = queries.update
    this.#deleteQuery = queries.delete
  }

  protected abstract query(stmt: string): Promise<any>

  _insert(stmt: string) {
    return this.query(stmt)
  }

  _update(stmt: string) {
    return this.query(stmt)
  }

  _delete(stmt: string) {
    return this.query(stmt)
  }

  insert() {
    return this._insert(this.#insertQuery)
  }

  update() {
    return this._update(this.#updateQuery)
  }

  delete() {
    return this._delete(this.#deleteQuery)
  }

  abstract selectAllFrom(table: string): Promise<any[]>

  abstract end(): Promise<void>
}
