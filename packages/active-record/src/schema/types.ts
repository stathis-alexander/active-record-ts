/**
 * Shared types for schema/migration emitters.
 */

/** Logical column type names used inside a migration `t.<type>(name, opts)`. */
export type ColumnType =
  | 'primary_key'
  | 'string'
  | 'text'
  | 'integer'
  | 'bigint'
  | 'float'
  | 'decimal'
  | 'numeric'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'timestamp'
  | 'time'
  | 'binary'
  | 'json'
  | 'jsonb'
  | 'uuid';

export type ColumnOptions = {
  null?: boolean;
  default?: unknown;
  /** Decimal precision. */
  precision?: number;
  /** Decimal scale. */
  scale?: number;
  /** Varchar limit. */
  limit?: number;
  index?: boolean | IndexOptions;
  primaryKey?: boolean;
};

export type IndexOptions = {
  name?: string;
  unique?: boolean;
};

export type ForeignKeyOptions = {
  column?: string;
  primaryKey?: string;
  name?: string;
  onDelete?: 'cascade' | 'restrict' | 'set_null' | 'set_default' | 'no_action';
  onUpdate?: 'cascade' | 'restrict' | 'set_null' | 'set_default' | 'no_action';
};

export type CreateTableOptions = {
  primaryKey?: string | false;
  ifNotExists?: boolean;
  /** Drop the existing table first (used during destructive recreations). */
  force?: boolean;
};

export type ColumnDefinition = {
  name: string;
  type: ColumnType;
  options: ColumnOptions;
};

/** Internal builder collected by `t.string('foo')` calls inside a `createTable` block. */
export type TableBuilder = {
  column: (name: string, type: ColumnType, options?: ColumnOptions) => TableBuilder;
  string: (name: string, options?: ColumnOptions) => TableBuilder;
  text: (name: string, options?: ColumnOptions) => TableBuilder;
  integer: (name: string, options?: ColumnOptions) => TableBuilder;
  bigint: (name: string, options?: ColumnOptions) => TableBuilder;
  float: (name: string, options?: ColumnOptions) => TableBuilder;
  decimal: (name: string, options?: ColumnOptions) => TableBuilder;
  boolean: (name: string, options?: ColumnOptions) => TableBuilder;
  date: (name: string, options?: ColumnOptions) => TableBuilder;
  datetime: (name: string, options?: ColumnOptions) => TableBuilder;
  timestamp: (name: string, options?: ColumnOptions) => TableBuilder;
  json: (name: string, options?: ColumnOptions) => TableBuilder;
  binary: (name: string, options?: ColumnOptions) => TableBuilder;
  uuid: (name: string, options?: ColumnOptions) => TableBuilder;
  references: (name: string, options?: ColumnOptions & { foreignKey?: boolean | ForeignKeyOptions }) => TableBuilder;
  /** `created_at` + `updated_at` shorthand. */
  timestamps: (options?: { null?: boolean }) => TableBuilder;
};

export type CollectedTable = {
  columns: ColumnDefinition[];
  indexes: Array<{ columns: string[]; options: IndexOptions }>;
  foreignKeys: Array<{ table: string; options: ForeignKeyOptions }>;
};
