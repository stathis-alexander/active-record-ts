/**
 * SQLite adapter backed by Bun's native `bun:sqlite`. Synchronous under
 * the hood; we wrap each call in a microtask for API uniformity.
 */

import { Arel } from '@arelts/arel';
import { ConnectionAdapter, type TransactionOptions } from '../ConnectionAdapter';
import type { ColumnInfo, ConnectionConfig, ExecResult, Row } from '../types';
import { resolveLogicalType } from '../ConnectionAdapter';

type SQLiteDatabase = {
  prepare: (sql: string) => SQLiteStatement;
  query: (sql: string) => SQLiteStatement;
  run: (sql: string, ...binds: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
  exec: (sql: string) => void;
  close: () => void;
};

type SQLiteStatement = {
  all: (...binds: unknown[]) => unknown[];
  get: (...binds: unknown[]) => unknown;
  run: (...binds: unknown[]) => { lastInsertRowid: number | bigint; changes: number };
};

export class SQLiteAdapter extends ConnectionAdapter {
  readonly adapterName = 'sqlite';
  private db: SQLiteDatabase | null = null;
  private visitor: Arel.Visitors.SQLite | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  arelVisitor(): Arel.Visitors.ToSql {
    if (!this.visitor) this.visitor = new Arel.Visitors.SQLite();
    return this.visitor;
  }

  async connect(): Promise<void> {
    // Lazy import so the adapter file is portable to non-Bun environments
    // (e.g. typecheck-only contexts).
    const { Database } = await import('bun:sqlite');
    const path = this.config.database ?? this.config.url ?? ':memory:';
    this.db = new Database(path) as unknown as SQLiteDatabase;
  }

  async disconnect(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  private requireDb(): SQLiteDatabase {
    if (!this.db) throw new Error('SQLiteAdapter is not connected — call connect() first');
    return this.db;
  }

  async execute(sql: string, binds: unknown[] = []): Promise<Row[]> {
    const db = this.requireDb();
    const stmt = db.prepare(sql);
    const cast = this.castBinds(binds);
    return stmt.all(...cast) as Row[];
  }

  async exec(sql: string, binds: unknown[] = []): Promise<ExecResult> {
    const db = this.requireDb();
    const cast = this.castBinds(binds);
    // Return rows when the statement is a RETURNING flavor.
    if (/\breturning\b/i.test(sql)) {
      const rows = db.prepare(sql).all(...cast) as Row[];
      return { rowsAffected: rows.length, returning: rows };
    }
    const stmt = db.prepare(sql);
    const result = stmt.run(...cast);
    return {
      rowsAffected: result.changes,
      lastInsertId: result.lastInsertRowid,
    };
  }

  async transaction<T>(fn: (adapter: this) => Promise<T>, _options?: TransactionOptions): Promise<T> {
    const db = this.requireDb();
    const label = this.txDepth === 0 ? null : `sp${this.txDepth}`;
    db.exec(label ? `SAVEPOINT ${label}` : 'BEGIN');
    this.txDepth++;
    try {
      const result = await fn(this);
      db.exec(label ? `RELEASE SAVEPOINT ${label}` : 'COMMIT');
      return result;
    } catch (err) {
      db.exec(label ? `ROLLBACK TO SAVEPOINT ${label}` : 'ROLLBACK');
      throw err;
    } finally {
      this.txDepth--;
    }
  }

  override quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`, [tableName]);
    return rows.length > 0;
  }

  async columns(tableName: string): Promise<ColumnInfo[]> {
    const rows = (await this.execute(`PRAGMA table_info(${this.quoteIdentifier(tableName)})`)) as Array<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;
    return rows.map((r) => ({
      name: r.name,
      sqlType: r.type,
      type: resolveLogicalType(r.type),
      null: r.notnull === 0,
      default: r.dflt_value,
      isPrimaryKey: r.pk > 0,
    }));
  }

  async primaryKey(tableName: string): Promise<string | null> {
    const cols = await this.columns(tableName);
    return cols.find((c) => c.isPrimaryKey)?.name ?? null;
  }
}
