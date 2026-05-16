/**
 * Migration base class. Subclasses implement `up` (and ideally `down`) and
 * use the inherited DSL methods to mutate schema. Migrations are versioned
 * by their static `version` property — typically a UTC timestamp string.
 */

import type { ConnectionAdapter } from './ConnectionAdapter';
import { SchemaStatements } from './schema/SchemaStatements';
import type {
  ColumnOptions,
  ColumnType,
  CreateTableOptions,
  ForeignKeyOptions,
  IndexOptions,
  TableBuilder,
} from './schema/types';

/** Marker symbol so consumers can check `migration instanceof Migration`. */
export abstract class Migration {
  /** Migration version — a sortable, unique string. Must be set on each subclass. */
  static version: string;

  private statements: SchemaStatements | null = null;

  /** Bind this migration to a connection. Internal — invoked by `Migrator`. */
  bind(adapter: ConnectionAdapter): void {
    this.statements = new SchemaStatements(adapter);
  }

  protected get schema(): SchemaStatements {
    if (!this.statements) throw new Error('Migration is not bound to an adapter');
    return this.statements;
  }

  /** Run the forward migration. Must be implemented by subclasses. */
  abstract up(): Promise<void>;

  /** Reverse the migration. Default is a no-op; override for proper down-migration. */
  async down(): Promise<void> {
    /* no-op */
  }

  // ──────────────────────────── DSL surface ────────────────────────────

  protected createTable(
    name: string,
    define: (t: TableBuilder) => void,
    options?: CreateTableOptions,
  ): Promise<void> {
    return this.schema.createTable(name, define, options);
  }

  protected dropTable(name: string, options?: { ifExists?: boolean }): Promise<void> {
    return this.schema.dropTable(name, options);
  }

  protected addColumn(table: string, name: string, type: ColumnType, options?: ColumnOptions): Promise<void> {
    return this.schema.addColumn(table, name, type, options);
  }

  protected removeColumn(table: string, name: string): Promise<void> {
    return this.schema.removeColumn(table, name);
  }

  protected renameColumn(table: string, from: string, to: string): Promise<void> {
    return this.schema.renameColumn(table, from, to);
  }

  protected addIndex(table: string, columns: string | string[], options?: IndexOptions): Promise<void> {
    return this.schema.addIndex(table, columns, options);
  }

  protected removeIndex(table: string, options: IndexOptions): Promise<void> {
    return this.schema.removeIndex(table, options);
  }

  protected addForeignKey(fromTable: string, toTable: string, options?: ForeignKeyOptions): Promise<void> {
    return this.schema.addForeignKey(fromTable, toTable, options);
  }

  protected execute(sql: string): Promise<void> {
    return this.schema.execute(sql);
  }
}

export type MigrationConstructor = (new () => Migration) & { version: string };
