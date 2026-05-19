/**
 * Abstract base for all connection adapters.
 *
 * Concrete adapters wrap a driver-specific connection or pool, expose a
 * uniform `execute`/`exec` surface, and own a `ToSql`-derived arel visitor
 * matched to the DB dialect.
 *
 * Adapters track a "current connection" used for transactions. Outside of
 * a `transaction(fn)` block, each `execute`/`exec` call may use any
 * available pooled connection. Inside a transaction, all calls are pinned
 * to the same connection so BEGIN/COMMIT semantics work.
 */

import { Arel, TreeManager } from '@active-record-ts/arel';
import type { ColumnInfo, ConnectionConfig, ExecResult, ForeignKeyInfo, IndexInfo, Row } from './types';

/** Errors thrown by adapters when the driver isn't installed. */
export class AdapterUnavailableError extends Error {
  constructor(driver: string, hint: string) {
    super(`Adapter driver "${driver}" is not available. ${hint}`);
  }
}

/** Thrown inside `transaction(fn)` to trigger a rollback without surfacing an error. */
export class Rollback extends Error {
  constructor(message = 'Rollback') {
    super(message);
  }
}

/** SQL-standard isolation levels. */
export type IsolationLevel = 'read_uncommitted' | 'read_committed' | 'repeatable_read' | 'serializable';

export const isolationLevelSql = (level: IsolationLevel): string => {
  switch (level) {
    case 'read_uncommitted':
      return 'READ UNCOMMITTED';
    case 'read_committed':
      return 'READ COMMITTED';
    case 'repeatable_read':
      return 'REPEATABLE READ';
    case 'serializable':
      return 'SERIALIZABLE';
  }
};

/** Thrown when an adapter cannot honor the requested isolation level. */
export class TransactionIsolationError extends Error {}

export type TransactionOptions = {
  /** Treat nested transactions as savepoints (default). */
  requiresNew?: boolean;
  /** Standard SQL isolation level — applies only to the outermost BEGIN. */
  isolation?: IsolationLevel;
};

/** Lower-cased SQL-type prefix -> active-model logical type name. */
const DEFAULT_TYPE_MAP: Array<[RegExp, string]> = [
  [/^bool/, 'boolean'],
  [/^bit\b/, 'boolean'],
  [/^big\s*int/, 'bigint'],
  [/^smallint/, 'integer'],
  [/^medium\s*int/, 'integer'],
  [/^int/, 'integer'],
  [/^bigserial/, 'bigint'],
  [/^serial/, 'integer'],
  [/^float/, 'float'],
  [/^real/, 'float'],
  [/^double/, 'float'],
  [/^numeric/, 'decimal'],
  [/^decimal/, 'decimal'],
  [/^money/, 'decimal'],
  [/^char/, 'string'],
  [/^varchar/, 'string'],
  [/^text/, 'string'],
  [/^uuid/, 'string'],
  [/^citext/, 'string'],
  [/^enum/, 'string'],
  [/^datetime/, 'datetime'],
  [/^timestamp/, 'datetime'],
  [/^date/, 'date'],
  [/^time\b/, 'datetime'],
  [/^jsonb?/, 'json'],
  [/^bytea/, 'binary'],
  [/^blob/, 'binary'],
  [/^binary/, 'binary'],
  [/^varbinary/, 'binary'],
];

export const resolveLogicalType = (sqlType: string): string => {
  const lower = sqlType.trim().toLowerCase();
  for (const [pattern, name] of DEFAULT_TYPE_MAP) if (pattern.test(lower)) return name;
  return 'value';
};

export abstract class ConnectionAdapter {
  readonly config: ConnectionConfig;
  /** Active transaction depth — 0 outside of `transaction`. */
  protected txDepth = 0;

  protected constructor(config: ConnectionConfig) {
    this.config = config;
  }

  /** Driver name (`'sqlite'`, `'postgres'`, …). Subclasses override. */
  abstract readonly adapterName: string;

  /** Build the arel visitor for this dialect. Cached on the instance. */
  abstract arelVisitor(): Arel.Visitors.ToSql;

  /** Establish underlying connection / pool. */
  abstract connect(): Promise<void>;

  /** Tear down the underlying connection / pool. */
  abstract disconnect(): Promise<void>;

  /** Execute a SELECT-style statement returning rows. */
  abstract execute(sql: string, binds?: unknown[]): Promise<Row[]>;

  /** Execute an INSERT/UPDATE/DELETE/DDL statement. */
  abstract exec(sql: string, binds?: unknown[]): Promise<ExecResult>;

  /** Run `fn` inside a transaction. Nested calls use savepoints. */
  abstract transaction<T>(fn: (adapter: this) => Promise<T>, options?: TransactionOptions): Promise<T>;

  /** Schema reflection: list all columns of a table. */
  abstract columns(tableName: string): Promise<ColumnInfo[]>;

  /** Schema reflection: primary key column name (or null). */
  abstract primaryKey(tableName: string): Promise<string | null>;

  /** Whether a table exists. */
  abstract tableExists(tableName: string): Promise<boolean>;

  /**
   * Schema reflection: list all user tables in the current schema/database.
   * Excludes `schema_migrations`, `ar_internal_metadata`, and any
   * driver-internal tables.
   */
  async tables(): Promise<string[]> {
    return [];
  }

  /** Schema reflection: list non-primary-key indexes on a table. */
  async indexes(_tableName: string): Promise<IndexInfo[]> {
    return [];
  }

  /** Schema reflection: list outbound foreign keys defined on a table. */
  async foreignKeys(_tableName: string): Promise<ForeignKeyInfo[]> {
    return [];
  }

  /** Adapter-specific identifier quoter. */
  quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  /** Convert an arel `TreeManager` (or AST node) into `[sql, binds]`. */
  toSql(manager: TreeManager | object): [string, unknown[]] {
    const visitor = this.arelVisitor();
    // PG's visitor caches a running bind-placeholder index; reset before each call.
    const resettable = visitor as { resetBindIndex?: () => void };
    resettable.resetBindIndex?.();
    const collector = new Arel.Collectors.Composite(new Arel.Collectors.SqlString(), new Arel.Collectors.Bind());
    const target = manager instanceof TreeManager ? manager.ast : manager;
    const [sql, binds] = visitor.accept(target, collector).value();
    return [sql as string, binds as unknown[]];
  }

  /** Adapter-supplied bind-value caster. Adapters may override. */
  castBind(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'bigint') return value.toString();
    return value;
  }

  /** Cast all binds for the driver layer. Returns a new array. */
  castBinds(binds: unknown[]): unknown[] {
    return binds.map((b) => this.castBind(b));
  }
}
