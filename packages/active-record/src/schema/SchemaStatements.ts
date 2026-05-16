/**
 * DDL emitter — converts logical `createTable`/`addColumn`/`addIndex`
 * calls into adapter-specific SQL strings.
 *
 * Each adapter subclasses or instantiates `SchemaStatements` and may
 * override `columnSql` to provide dialect-specific column rendering.
 */

import type { ConnectionAdapter } from '../ConnectionAdapter';
import { createTableBuilder } from './TableBuilder';
import type {
  CollectedTable,
  ColumnDefinition,
  ColumnOptions,
  ColumnType,
  CreateTableOptions,
  ForeignKeyOptions,
  IndexOptions,
  TableBuilder,
} from './types';

export class SchemaStatements {
  constructor(public readonly adapter: ConnectionAdapter) {}

  protected quote(name: string): string {
    return this.adapter.quoteIdentifier(name);
  }

  /** Default column-type mapping. Subclasses override for dialect specifics. */
  protected typeForColumn(column: ColumnDefinition): string {
    const { type, options } = column;
    return columnTypeForAdapter(this.adapter.adapterName, type, options);
  }

  /** Render a single column line of a CREATE TABLE statement. */
  columnSql(column: ColumnDefinition, _options?: CreateTableOptions): string {
    const parts = [this.quote(column.name), this.typeForColumn(column)];
    const { options } = column;
    if (options.null === false) parts.push('NOT NULL');
    if (options.default !== undefined) parts.push(`DEFAULT ${quoteDefault(options.default)}`);
    return parts.join(' ');
  }

  /** Render the primary key column line. */
  protected primaryKeySql(name: string): string {
    return primaryKeySqlForAdapter(this.adapter.adapterName, this.quote(name));
  }

  /** Build a CREATE TABLE statement. */
  async createTable(
    tableName: string,
    define: (t: TableBuilder) => void,
    options: CreateTableOptions = {},
  ): Promise<void> {
    const collected: CollectedTable = { columns: [], indexes: [], foreignKeys: [] };
    define(createTableBuilder(collected));
    // `force: true` drops the existing table first (parity with Rails).
    if (options.force) {
      await this.dropTable(tableName, { ifExists: true });
    }
    const lines: string[] = [];
    if (options.primaryKey !== false) {
      const pk = typeof options.primaryKey === 'string' ? options.primaryKey : 'id';
      lines.push(this.primaryKeySql(pk));
    }
    for (const col of collected.columns) lines.push(this.columnSql(col, options));
    const sql = `CREATE TABLE ${options.ifNotExists ? 'IF NOT EXISTS ' : ''}${this.quote(tableName)} (\n  ${lines.join(',\n  ')}\n)`;
    await this.adapter.exec(sql);
    for (const idx of collected.indexes) {
      await this.addIndex(tableName, idx.columns, idx.options);
    }
    for (const fk of collected.foreignKeys) {
      await this.addForeignKey(tableName, fk.table, fk.options);
    }
  }

  async dropTable(tableName: string, options: { ifExists?: boolean } = {}): Promise<void> {
    await this.adapter.exec(`DROP TABLE ${options.ifExists ? 'IF EXISTS ' : ''}${this.quote(tableName)}`);
  }

  /** Rename an existing table. */
  async renameTable(from: string, to: string): Promise<void> {
    await this.adapter.exec(`ALTER TABLE ${this.quote(from)} RENAME TO ${this.quote(to)}`);
  }

  async addColumn(
    tableName: string,
    name: string,
    type: ColumnType,
    options: ColumnOptions & { ifNotExists?: boolean } = {},
  ): Promise<void> {
    if (options.ifNotExists && (await this.columnExists(tableName, name))) return;
    const { ifNotExists: _ifNotExists, ...colOpts } = options;
    const sql = `ALTER TABLE ${this.quote(tableName)} ADD COLUMN ${this.columnSql({ name, type, options: colOpts })}`;
    await this.adapter.exec(sql);
  }

  async removeColumn(
    tableName: string,
    name: string,
    options: { ifExists?: boolean } = {},
  ): Promise<void> {
    if (options.ifExists && !(await this.columnExists(tableName, name))) return;
    await this.adapter.exec(`ALTER TABLE ${this.quote(tableName)} DROP COLUMN ${this.quote(name)}`);
  }

  async renameColumn(tableName: string, from: string, to: string): Promise<void> {
    await this.adapter.exec(
      `ALTER TABLE ${this.quote(tableName)} RENAME COLUMN ${this.quote(from)} TO ${this.quote(to)}`,
    );
  }

  /**
   * Change a column's type. SQLite doesn't support this in-place, so we
   * delegate to the adapter when present, else emit an ALTER TABLE that
   * Postgres / MySQL understand.
   */
  async changeColumn(
    tableName: string,
    name: string,
    type: ColumnType,
    options: ColumnOptions = {},
  ): Promise<void> {
    const adapterName = this.adapter.adapterName;
    const colSpec = this.typeForColumn({ name, type, options });
    if (adapterName === 'mysql') {
      await this.adapter.exec(`ALTER TABLE ${this.quote(tableName)} MODIFY ${this.quote(name)} ${colSpec}`);
      return;
    }
    if (adapterName === 'postgres' || adapterName === 'postgres-bun') {
      await this.adapter.exec(`ALTER TABLE ${this.quote(tableName)} ALTER COLUMN ${this.quote(name)} TYPE ${colSpec}`);
      return;
    }
    throw new Error(`changeColumn is not supported on adapter "${adapterName}"`);
  }

  /** Whether a column already exists on the named table. */
  async columnExists(tableName: string, columnName: string): Promise<boolean> {
    const cols = await this.adapter.columns(tableName).catch(() => []);
    return cols.some((c) => c.name === columnName);
  }

  async addIndex(tableName: string, columns: string | string[], options: IndexOptions = {}): Promise<void> {
    const cols = Array.isArray(columns) ? columns : [columns];
    const name = options.name ?? `index_${tableName}_on_${cols.join('_and_')}`;
    const unique = options.unique ? 'UNIQUE ' : '';
    const sql = `CREATE ${unique}INDEX ${this.quote(name)} ON ${this.quote(tableName)} (${cols.map((c) => this.quote(c)).join(', ')})`;
    await this.adapter.exec(sql);
  }

  async removeIndex(tableName: string, options: IndexOptions = {}): Promise<void> {
    if (!options.name) throw new Error('removeIndex requires an explicit `name`');
    await this.adapter.exec(`DROP INDEX ${this.quote(options.name)}`);
  }

  async addForeignKey(fromTable: string, toTable: string, options: ForeignKeyOptions = {}): Promise<void> {
    const column = options.column ?? `${singularize(toTable)}_id`;
    const primary = options.primaryKey ?? 'id';
    const name = options.name ?? `fk_${fromTable}_${column}`;
    let sql = `ALTER TABLE ${this.quote(fromTable)} ADD CONSTRAINT ${this.quote(name)} FOREIGN KEY (${this.quote(column)}) REFERENCES ${this.quote(toTable)}(${this.quote(primary)})`;
    if (options.onDelete) sql += ` ON DELETE ${actionSql(options.onDelete)}`;
    if (options.onUpdate) sql += ` ON UPDATE ${actionSql(options.onUpdate)}`;
    await this.adapter.exec(sql);
  }

  async execute(sql: string): Promise<void> {
    await this.adapter.exec(sql);
  }
}

const singularize = (word: string): string => (word.endsWith('s') ? word.slice(0, -1) : word);
const actionSql = (action: string): string => action.toUpperCase().replace(/_/g, ' ');

const quoteDefault = (value: unknown): string => {
  if (value === null) return 'NULL';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
};

/** Map a logical column type to dialect-specific SQL. */
export const columnTypeForAdapter = (
  adapter: string,
  type: ColumnType,
  options: ColumnOptions,
): string => {
  const isMySQL = adapter === 'mysql';
  const isPG = adapter === 'postgres' || adapter === 'postgres-bun';
  const isSQLite = adapter === 'sqlite';
  switch (type) {
    case 'primary_key':
      return isPG ? 'BIGSERIAL PRIMARY KEY' : isMySQL ? 'BIGINT AUTO_INCREMENT PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
    case 'string': {
      const limit = options.limit ?? 255;
      return `VARCHAR(${limit})`;
    }
    case 'text':
      return 'TEXT';
    case 'integer':
      return 'INTEGER';
    case 'bigint':
      return 'BIGINT';
    case 'float':
      return isSQLite ? 'REAL' : 'DOUBLE PRECISION';
    case 'decimal':
    case 'numeric': {
      if (options.precision != null) {
        return `DECIMAL(${options.precision}${options.scale != null ? `, ${options.scale}` : ''})`;
      }
      return 'DECIMAL';
    }
    case 'boolean':
      return isMySQL ? 'TINYINT(1)' : isSQLite ? 'INTEGER' : 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
    case 'timestamp':
      return isPG ? 'TIMESTAMP' : isMySQL ? 'DATETIME' : 'DATETIME';
    case 'time':
      return 'TIME';
    case 'binary':
      return isPG ? 'BYTEA' : isMySQL ? 'BLOB' : 'BLOB';
    case 'json':
      return isPG ? 'JSONB' : isMySQL ? 'JSON' : 'TEXT';
    case 'jsonb':
      return isPG ? 'JSONB' : isMySQL ? 'JSON' : 'TEXT';
    case 'uuid':
      return isPG ? 'UUID' : 'VARCHAR(36)';
    default: {
      const exhaustive: never = type;
      throw new Error(`Unknown column type: ${exhaustive as string}`);
    }
  }
};

/** Compute the primary-key column line for `CREATE TABLE`. */
export const primaryKeySqlForAdapter = (adapter: string, quotedName: string): string => {
  if (adapter === 'postgres' || adapter === 'postgres-bun') return `${quotedName} BIGSERIAL PRIMARY KEY`;
  if (adapter === 'mysql') return `${quotedName} BIGINT AUTO_INCREMENT PRIMARY KEY`;
  return `${quotedName} INTEGER PRIMARY KEY AUTOINCREMENT`;
};
