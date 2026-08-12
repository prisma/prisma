/**
 * Family-agnostic textual preview of a migration plan, used by the CLI to
 * render a "DDL preview" section for `db init` / `db update` / `migration plan`
 * / `migration show`. Each statement carries a free-form `language` tag so
 * formatters can suffix `;` for SQL but render Mongo shell lines verbatim.
 *
 * Producers are family-specific: SQL emits `language: 'sql'` (existing DDL
 * extraction); Mongo emits `language: 'mongodb-shell'` via the
 * `MongoDdlCommandFormatter` visitor.
 *
 * The capability `OperationPreviewCapable` (declared in
 * `./control-capabilities`) is how a family announces it can produce these.
 */

export interface OperationPreviewStatement {
  readonly text: string;
  /** Dialect identifier, e.g. `'sql'`, `'mongodb-shell'`. Free-form by design (OQ-3). */
  readonly language: string;
}

export interface OperationPreview {
  readonly statements: readonly OperationPreviewStatement[];
}
