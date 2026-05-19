/**
 * `defineSchema(callback)` — declarative schema entry-point used by the
 * generated `db/schema.ts`. The callback receives a `SchemaBuilder` whose
 * surface mirrors the migration DSL: `createTable`, `addIndex`,
 * `addForeignKey`, `execute`.
 *
 * The function returns a `SchemaDefinition` object that can either be
 * inspected (for tests and tooling) or applied against an adapter via
 * `loadSchema(adapter, definition)` — the latter is how `db:schema:load`
 * recreates a database from scratch.
 */

import type { ConnectionAdapter } from '../ConnectionAdapter';
import { SchemaStatements } from './SchemaStatements';
import { createTableBuilder } from './TableBuilder';
import type {
  CollectedTable,
  ColumnDefinition,
  CreateTableOptions,
  ForeignKeyOptions,
  IndexOptions,
  TableBuilder,
} from './types';

export type CreateTableEntry = {
  kind: 'createTable';
  name: string;
  options: CreateTableOptions;
  collected: CollectedTable;
};

export type AddIndexEntry = {
  kind: 'addIndex';
  table: string;
  columns: string[];
  options: IndexOptions;
};

export type AddForeignKeyEntry = {
  kind: 'addForeignKey';
  fromTable: string;
  toTable: string;
  options: ForeignKeyOptions;
};

export type ExecuteEntry = {
  kind: 'execute';
  sql: string;
};

export type SchemaEntry = CreateTableEntry | AddIndexEntry | AddForeignKeyEntry | ExecuteEntry;

export type SchemaBuilder = {
  createTable: (
    name: string,
    define: (t: TableBuilder) => void,
    options?: CreateTableOptions,
  ) => void;
  addIndex: (table: string, columns: string | string[], options?: IndexOptions) => void;
  addForeignKey: (fromTable: string, toTable: string, options?: ForeignKeyOptions) => void;
  execute: (sql: string) => void;
};

export type SchemaDefinition = {
  entries: SchemaEntry[];
  apply: (adapter: ConnectionAdapter) => Promise<void>;
};

/** Capture a schema definition without running it. */
export const defineSchema = (build: (s: SchemaBuilder) => void): SchemaDefinition => {
  const entries: SchemaEntry[] = [];
  const builder: SchemaBuilder = {
    createTable: (name, define, options = {}) => {
      const collected: CollectedTable = { columns: [], indexes: [], foreignKeys: [] };
      define(createTableBuilder(collected));
      entries.push({ kind: 'createTable', name, options, collected });
    },
    addIndex: (table, columns, options = {}) => {
      entries.push({
        kind: 'addIndex',
        table,
        columns: Array.isArray(columns) ? columns : [columns],
        options,
      });
    },
    addForeignKey: (fromTable, toTable, options = {}) => {
      entries.push({ kind: 'addForeignKey', fromTable, toTable, options });
    },
    execute: (sql) => entries.push({ kind: 'execute', sql }),
  };
  build(builder);

  return {
    entries,
    apply: async (adapter) => applyEntries(adapter, entries),
  };
};

const applyEntries = async (adapter: ConnectionAdapter, entries: SchemaEntry[]): Promise<void> => {
  const schema = new SchemaStatements(adapter);
  for (const entry of entries) {
    await applyEntry(schema, entry);
  }
};

const applyEntry = async (schema: SchemaStatements, entry: SchemaEntry): Promise<void> => {
  switch (entry.kind) {
    case 'createTable':
      await schema.createTable(
        entry.name,
        (t) => replayColumns(t, entry.collected.columns),
        entry.options,
      );
      for (const idx of entry.collected.indexes) {
        await schema.addIndex(entry.name, idx.columns, idx.options);
      }
      for (const fk of entry.collected.foreignKeys) {
        await schema.addForeignKey(entry.name, fk.table, fk.options);
      }
      return;
    case 'addIndex':
      await schema.addIndex(entry.table, entry.columns, entry.options);
      return;
    case 'addForeignKey':
      await schema.addForeignKey(entry.fromTable, entry.toTable, entry.options);
      return;
    case 'execute':
      await schema.execute(entry.sql);
      return;
  }
};

/** Replay a captured column list against a live TableBuilder. */
const replayColumns = (t: TableBuilder, columns: ColumnDefinition[]): void => {
  for (const col of columns) {
    t.column(col.name, col.type, col.options);
  }
};

/**
 * Run `definition.apply` against `adapter`. Drops every user table first so
 * the schema is reset deterministically — matches Rails' `db:schema:load`.
 */
export const loadSchema = async (
  adapter: ConnectionAdapter,
  definition: SchemaDefinition,
  options: { reset?: boolean } = {},
): Promise<void> => {
  if (options.reset !== false) {
    const existing = await adapter.tables();
    const schema = new SchemaStatements(adapter);
    for (const table of existing.reverse()) {
      await schema.dropTable(table, { ifExists: true });
    }
  }
  await definition.apply(adapter);
};
