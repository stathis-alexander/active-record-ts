/**
 * Shared types for the active-record package. Keeping these in a single
 * file avoids circular-import headaches between adapters, base, and
 * relation.
 */

/** Logical adapter id passed to `establishConnection`. */
export type AdapterName = 'sqlite' | 'postgres' | 'postgres-bun' | 'mysql';

/** Connection options. Each adapter consumes the subset it understands. */
export type ConnectionConfig = {
  adapter: AdapterName;
  /** Driver-specific URL (`postgres://...`, `mysql://...`, file path for sqlite). */
  url?: string;
  /** SQLite-only: path on disk or `:memory:`. */
  database?: string;
  host?: string;
  port?: number;
  user?: string;
  username?: string;
  password?: string;
  /** Driver-specific options forwarded verbatim. */
  options?: Record<string, unknown>;
};

/** A row returned by `execute`. */
export type Row = Record<string, unknown>;

/** Outcome of a non-row-producing statement. */
export type ExecResult = {
  rowsAffected: number;
  /** Last-insert id for adapters that surface one (SQLite, MySQL). */
  lastInsertId?: number | bigint | string | null;
  /** RETURNING rows for adapters that support it (PG always, SQLite via RETURNING). */
  returning?: Row[];
};

/** Column metadata returned by `columns()`. */
export type ColumnInfo = {
  name: string;
  /** Adapter-specific raw type string (e.g. `varchar(255)`, `int4`). */
  sqlType: string;
  /** Logical type name resolvable in active-model's Type registry. */
  type: string;
  null: boolean;
  default: unknown;
  isPrimaryKey: boolean;
};
