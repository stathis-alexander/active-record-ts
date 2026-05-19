/**
 * Postgres adapter backed by Bun's native `Bun.SQL`. Falls back to the
 * `postgres` npm package adapter if `Bun.sql` is unavailable.
 */

import { Arel } from '@arelts/arel';
import { ConnectionAdapter, AdapterUnavailableError, isolationLevelSql, type TransactionOptions } from '../ConnectionAdapter';
import { resolveLogicalType } from '../ConnectionAdapter';
import type { ColumnInfo, ConnectionConfig, ExecResult, Row } from '../types';

// biome-ignore lint/suspicious/noExplicitAny: Bun.SQL surface is dynamic
type BunSQL = any;

export class PostgresBunAdapter extends ConnectionAdapter {
  readonly adapterName = 'postgres-bun';
  protected sql: BunSQL | null = null;
  private visitor: Arel.Visitors.PostgreSQL | null = null;
  private txClient: BunSQL | null = null;

  constructor(config: ConnectionConfig) {
    super(config);
  }

  arelVisitor(): Arel.Visitors.ToSql {
    if (!this.visitor) this.visitor = new Arel.Visitors.PostgreSQL();
    return this.visitor;
  }

  async connect(): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: Bun.SQL surface is dynamic
    const bunSql = (Bun as any).sql as undefined | ((connection: string | object) => BunSQL);
    if (!bunSql) {
      throw new AdapterUnavailableError(
        'Bun.SQL',
        'Bun.sql is not available in this Bun version — use the `postgres` adapter instead.',
      );
    }
    const opts: Record<string, unknown> = { ...(this.config.options ?? {}) };
    if (this.config.url) {
      this.sql = bunSql(this.config.url);
    } else {
      this.sql = bunSql({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user ?? this.config.username,
        password: this.config.password,
        database: this.config.database,
        ...opts,
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.sql?.close) await this.sql.close();
    else if (this.sql?.end) await this.sql.end();
    this.sql = null;
  }

  protected client(): BunSQL {
    const c = this.txClient ?? this.sql;
    if (!c) throw new Error('PostgresBunAdapter is not connected — call connect() first');
    return c;
  }

  async execute(sql: string, binds: unknown[] = []): Promise<Row[]> {
    const cast = this.castBinds(binds);
    const result = await this.client().unsafe(sql, cast);
    return Array.from(result as Iterable<Row>) as Row[];
  }

  async exec(sql: string, binds: unknown[] = []): Promise<ExecResult> {
    const cast = this.castBinds(binds);
    const result = await this.client().unsafe(sql, cast);
    const rows = Array.from(result as Iterable<Row>) as Row[];
    const rowsAffected = ((result as { count?: number }).count) ?? rows.length;
    return rows.length > 0 ? { rowsAffected, returning: rows } : { rowsAffected };
  }

  async transaction<T>(fn: (adapter: this) => Promise<T>, options?: TransactionOptions): Promise<T> {
    if (!this.sql) throw new Error('PostgresBunAdapter is not connected — call connect() first');
    if (this.txClient) {
      const label = `sp${this.txDepth}`;
      this.txDepth++;
      try {
        await this.txClient.unsafe(`SAVEPOINT ${label}`);
        const result = await fn(this);
        await this.txClient.unsafe(`RELEASE SAVEPOINT ${label}`);
        return result;
      } catch (err) {
        await this.txClient.unsafe(`ROLLBACK TO SAVEPOINT ${label}`);
        throw err;
      } finally {
        this.txDepth--;
      }
    }
    return this.sql.begin(async (client: BunSQL) => {
      const prev = this.txClient;
      this.txClient = client;
      this.txDepth++;
      try {
        if (options?.isolation) {
          await client.unsafe(`SET TRANSACTION ISOLATION LEVEL ${isolationLevelSql(options.isolation)}`);
        }
        return await fn(this);
      } finally {
        this.txClient = prev;
        this.txDepth--;
      }
    });
  }

  override quoteIdentifier(name: string): string {
    return `"${name.replace(/"/g, '""')}"`;
  }

  async tableExists(tableName: string): Promise<boolean> {
    const rows = await this.execute(
      `SELECT 1 FROM information_schema.tables WHERE table_name = $1 AND table_schema = ANY (current_schemas(false)) LIMIT 1`,
      [tableName],
    );
    return rows.length > 0;
  }

  async columns(tableName: string): Promise<ColumnInfo[]> {
    const pkSet = new Set(await this.primaryKeys(tableName));
    const rows = (await this.execute(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_name = $1 AND table_schema = ANY (current_schemas(false))
       ORDER BY ordinal_position`,
      [tableName],
    )) as Array<{
      column_name: string;
      data_type: string;
      udt_name: string;
      is_nullable: string;
      column_default: unknown;
    }>;
    return rows.map((r) => {
      const sqlType = r.udt_name ?? r.data_type;
      return {
        name: r.column_name,
        sqlType,
        type: resolveLogicalType(sqlType),
        null: r.is_nullable === 'YES',
        default: r.column_default,
        isPrimaryKey: pkSet.has(r.column_name),
      };
    });
  }

  async primaryKey(tableName: string): Promise<string | null> {
    const keys = await this.primaryKeys(tableName);
    return keys[0] ?? null;
  }

  private async primaryKeys(tableName: string): Promise<string[]> {
    const rows = (await this.execute(
      `SELECT a.attname
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = $1::regclass AND i.indisprimary`,
      [tableName],
    )) as Array<{ attname: string }>;
    return rows.map((r) => r.attname);
  }
}
