/**
 * MySQL adapter backed by `mysql2/promise`. MySQL uses `?` placeholders
 * which the arel MySQL visitor already emits.
 */

import { Arel } from '@arelts/arel';
import { ConnectionAdapter, AdapterUnavailableError, isolationLevelSql, type TransactionOptions } from '../ConnectionAdapter';
import { resolveLogicalType } from '../ConnectionAdapter';
import type { ColumnInfo, ConnectionConfig, ExecResult, ForeignKeyInfo, IndexInfo, Row } from '../types';
import { MySQLAdapterVisitor } from './MySQLVisitor';

// biome-ignore lint/suspicious/noExplicitAny: driver shape varies
type Pool = any;
// biome-ignore lint/suspicious/noExplicitAny: driver shape varies
type Connection = any;

export class MySQLAdapter extends ConnectionAdapter {
  readonly adapterName = 'mysql';
  private pool: Pool | null = null;
  private txConn: Connection | null = null;
  private visitor: MySQLAdapterVisitor | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  arelVisitor(): Arel.Visitors.ToSql {
    if (!this.visitor) this.visitor = new MySQLAdapterVisitor();
    return this.visitor;
  }

  async connect(): Promise<void> {
    let mysql: { createPool: (config: object) => Pool };
    try {
      mysql = (await import('mysql2/promise')) as unknown as { createPool: (config: object) => Pool };
    } catch {
      throw new AdapterUnavailableError(
        'mysql2',
        'Install the `mysql2` npm package (bun add mysql2).',
      );
    }
    const baseOptions: Record<string, unknown> = { ...(this.config.options ?? {}) };
    if (this.config.url) {
      this.pool = mysql.createPool({ uri: this.config.url, ...baseOptions });
    } else {
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user ?? this.config.username,
        password: this.config.password,
        database: this.config.database,
        ...baseOptions,
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) await this.pool.end();
    this.pool = null;
  }

  private async exectx<T>(fn: (conn: Connection) => Promise<T>): Promise<T> {
    if (this.txConn) return fn(this.txConn);
    if (!this.pool) throw new Error('MySQLAdapter is not connected — call connect() first');
    const conn: Connection = await this.pool.getConnection();
    try {
      return await fn(conn);
    } finally {
      conn.release();
    }
  }

  async execute(sql: string, binds: unknown[] = []): Promise<Row[]> {
    const cast = this.castBinds(binds);
    const [rows] = (await this.exectx((c) => c.query(sql, cast))) as [Row[], unknown];
    return Array.isArray(rows) ? (rows as Row[]) : [];
  }

  async exec(sql: string, binds: unknown[] = []): Promise<ExecResult> {
    const cast = this.castBinds(binds);
    const [result] = (await this.exectx((c) => c.query(sql, cast))) as [
      Row[] | { affectedRows: number; insertId: number },
      unknown,
    ];
    if (Array.isArray(result)) {
      return { rowsAffected: result.length, returning: result as Row[] };
    }
    return {
      rowsAffected: result.affectedRows ?? 0,
      lastInsertId: result.insertId,
    };
  }

  async transaction<T>(fn: (adapter: this) => Promise<T>, options?: TransactionOptions): Promise<T> {
    if (!this.pool) throw new Error('MySQLAdapter is not connected — call connect() first');
    if (this.txConn) {
      const label = `sp${this.txDepth}`;
      this.txDepth++;
      try {
        await this.txConn.query(`SAVEPOINT ${label}`);
        const result = await fn(this);
        await this.txConn.query(`RELEASE SAVEPOINT ${label}`);
        return result;
      } catch (err) {
        await this.txConn.query(`ROLLBACK TO SAVEPOINT ${label}`);
        throw err;
      } finally {
        this.txDepth--;
      }
    }
    const conn: Connection = await this.pool.getConnection();
    this.txConn = conn;
    this.txDepth++;
    try {
      if (options?.isolation) {
        await conn.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevelSql(options.isolation)}`);
      }
      await conn.beginTransaction();
      const result = await fn(this);
      await conn.commit();
      return result;
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        /* ignore secondary errors during rollback */
      }
      throw err;
    } finally {
      this.txDepth--;
      this.txConn = null;
      conn.release();
    }
  }

  override quoteIdentifier(name: string): string {
    return `\`${name.replace(/`/g, '``')}\``;
  }

  /** MySQL DATETIME expects `YYYY-MM-DD HH:MM:SS`, not ISO 8601 with `T`/`Z`. */
  override castBind(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString().replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return value.replace('T', ' ').replace('Z', '').replace(/\.\d+$/, '');
    }
    if (typeof value === 'bigint') return value.toString();
    return value;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.execute(
      `SELECT 1 FROM information_schema.tables WHERE table_name = ? AND table_schema = DATABASE() LIMIT 1`,
      [tableName],
    );
    return rows.length > 0;
  }

  async columns(tableName: string): Promise<ColumnInfo[]> {
    const rows = (await this.execute(
      `SELECT column_name AS name, data_type AS sql_type, column_type AS column_type, is_nullable, column_default, column_key
       FROM information_schema.columns
       WHERE table_name = ? AND table_schema = DATABASE()
       ORDER BY ordinal_position`,
      [tableName],
    )) as Array<{
      name: string;
      sql_type: string;
      column_type: string;
      is_nullable: string;
      column_default: unknown;
      column_key: string;
    }>;
    return rows.map((r) => {
      const sqlType = r.column_type ?? r.sql_type;
      return {
        name: r.name,
        sqlType,
        type: resolveLogicalType(sqlType),
        null: r.is_nullable === 'YES',
        default: r.column_default,
        isPrimaryKey: r.column_key === 'PRI',
      };
    });
  }

  async primaryKey(tableName: string): Promise<string | null> {
    const cols = await this.columns(tableName);
    return cols.find((c) => c.isPrimaryKey)?.name ?? null;
  }

  override async tables(): Promise<string[]> {
    const rows = (await this.execute(
      `SELECT table_name AS name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    )) as Array<{ name: string }>;
    return rows
      .map((r) => r.name)
      .filter((n) => n !== 'schema_migrations' && n !== 'ar_internal_metadata');
  }

  override async indexes(tableName: string): Promise<IndexInfo[]> {
    const rows = (await this.execute(
      `SELECT index_name AS name, column_name AS column_name, non_unique AS non_unique, seq_in_index AS seq
       FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = ? AND index_name <> 'PRIMARY'
       ORDER BY index_name, seq_in_index`,
      [tableName],
    )) as Array<{ name: string; column_name: string; non_unique: number; seq: number }>;
    const byName = new Map<string, IndexInfo>();
    for (const r of rows) {
      let entry = byName.get(r.name);
      if (!entry) {
        entry = { name: r.name, columns: [], unique: Number(r.non_unique) === 0 };
        byName.set(r.name, entry);
      }
      entry.columns.push(r.column_name);
    }
    return Array.from(byName.values());
  }

  override async foreignKeys(tableName: string): Promise<ForeignKeyInfo[]> {
    const rows = (await this.execute(
      `SELECT kcu.constraint_name AS name,
              kcu.column_name AS column_name,
              kcu.referenced_table_name AS to_table,
              kcu.referenced_column_name AS to_column,
              rc.delete_rule AS on_delete,
              rc.update_rule AS on_update
       FROM information_schema.key_column_usage kcu
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_name = kcu.constraint_name
        AND rc.constraint_schema = kcu.table_schema
       WHERE kcu.table_schema = DATABASE()
         AND kcu.table_name = ?
         AND kcu.referenced_table_name IS NOT NULL
       ORDER BY kcu.constraint_name`,
      [tableName],
    )) as Array<{ name: string; column_name: string; to_table: string; to_column: string; on_delete: string; on_update: string }>;
    return rows.map((r) => ({
      name: r.name,
      fromTable: tableName,
      toTable: r.to_table,
      column: r.column_name,
      primaryKey: r.to_column,
      onDelete: r.on_delete && r.on_delete !== 'NO ACTION' && r.on_delete !== 'RESTRICT' ? r.on_delete.toLowerCase().replace(/ /g, '_') : undefined,
      onUpdate: r.on_update && r.on_update !== 'NO ACTION' && r.on_update !== 'RESTRICT' ? r.on_update.toLowerCase().replace(/ /g, '_') : undefined,
    }));
  }
}
