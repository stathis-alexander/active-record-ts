/**
 * Dump the current database structure to a `schema.ts` source file.
 *
 * The generated file looks like:
 *
 *   import { defineSchema } from '@arelts/active-record';
 *
 *   export const version = '20260101000003';
 *
 *   export default defineSchema((s) => {
 *     s.createTable('users', (t) => {
 *       t.string('email', { null: false });
 *       t.timestamps();
 *     });
 *     s.addIndex('users', ['email'], { unique: true });
 *   });
 *
 * The schema is generated against the active connection — typically right
 * after `db:migrate` so the committed `schema.ts` matches the just-applied
 * migrations. It's the same idea as Rails' `db/schema.rb`.
 */

import type { ConnectionAdapter } from '../ConnectionAdapter';
import type { ColumnInfo, ForeignKeyInfo, IndexInfo } from '../types';
import type { ColumnOptions, ColumnType } from './types';

/** Map an adapter's raw `sqlType` to a logical migration `ColumnType` + options. */
const inferColumn = (
  adapterName: string,
  col: ColumnInfo,
): { type: ColumnType; options: ColumnOptions } => {
  const sql = col.sqlType.toLowerCase().trim();
  const options: ColumnOptions = {};
  if (col.null === false) options.null = false;
  if (col.default !== null && col.default !== undefined) {
    const literal = parseDefault(col.default);
    if (literal !== undefined) options.default = literal;
  }

  // Pull a varchar limit out of "varchar(255)" / "character varying(255)".
  const lenMatch = sql.match(/(?:character varying|varchar)\((\d+)\)/);
  if (lenMatch?.[1]) options.limit = Number(lenMatch[1]);

  const decimalMatch = sql.match(/(?:decimal|numeric)\((\d+)(?:,\s*(\d+))?\)/);
  if (decimalMatch) {
    options.precision = Number(decimalMatch[1]);
    if (decimalMatch[2]) options.scale = Number(decimalMatch[2]);
  }

  // Order matters — longer prefixes first.
  if (/^bool|^bit\b|^tinyint\(1\)/.test(sql)) return { type: 'boolean', options };
  if (/^bigint|^bigserial/.test(sql)) return { type: 'bigint', options };
  if (/^(smallint|mediumint|int|integer|serial)/.test(sql)) return { type: 'integer', options };
  if (/^(double|real|float)/.test(sql)) return { type: 'float', options };
  if (/^(decimal|numeric|money)/.test(sql)) return { type: 'decimal', options };
  if (/^uuid/.test(sql)) return { type: 'uuid', options };
  if (/^(character varying|varchar|char\b|citext|enum|nvarchar)/.test(sql)) return { type: 'string', options };
  if (/^text|^longtext|^mediumtext|^tinytext/.test(sql)) return { type: 'text', options };
  if (/^jsonb/.test(sql)) return { type: 'jsonb', options };
  if (/^json/.test(sql)) return { type: 'json', options };
  if (/^date\b/.test(sql)) return { type: 'date', options };
  if (/^datetime/.test(sql)) return { type: 'datetime', options };
  if (/^timestamp/.test(sql)) return { type: 'datetime', options };
  if (/^time\b/.test(sql)) return { type: 'time', options };
  if (/^(bytea|blob|binary|varbinary)/.test(sql)) return { type: 'binary', options };

  // Postgres reflection sometimes returns `udt_name` like `int4` rather
  // than `integer`. Handle those.
  if (sql === 'int4' || sql === 'int8' || sql === 'int2') {
    return { type: sql === 'int8' ? 'bigint' : 'integer', options };
  }
  if (sql === 'float8' || sql === 'float4') return { type: 'float', options };
  if (sql === 'bpchar') return { type: 'string', options };

  // Fall back to text — better than crashing.
  if (adapterName === 'sqlite' && sql === '') return { type: 'string', options };
  return { type: 'text', options };
};

/**
 * Best-effort default-literal interpreter.
 *
 * SQLite stores defaults as raw SQL strings (`'foo'`, `0`); Postgres
 * returns expressions (`'foo'::character varying`, `nextval('users_id_seq')`).
 * We drop sequence-default columns (they belong to the primary key), strip
 * Postgres type casts, and unquote string literals. Anything we don't
 * recognize is kept as a raw SQL fragment — encoded as `{ sql: '...' }` —
 * so the generated schema.ts preserves it on round-trip.
 */
const parseDefault = (value: unknown): unknown => {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'string') return value;
  let s = value.trim();
  if (s === '') return undefined;
  if (/^nextval\(/i.test(s)) return undefined;
  // Strip Postgres type casts: `'foo'::character varying` -> `'foo'`.
  s = s.replace(/::[a-zA-Z_][\w\s]*(\(\d+(?:,\s*\d+)?\))?$/, '');
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === 'true';
  if (s === 'NULL') return null;
  const stringMatch = s.match(/^'(.*)'$/s);
  if (stringMatch) return stringMatch[1]?.replace(/''/g, "'");
  // Function-y default (e.g. `CURRENT_TIMESTAMP`). Keep as raw SQL.
  return { sql: s };
};

const stringifyOptions = (options: ColumnOptions): string => {
  const keys = Object.keys(options) as Array<keyof ColumnOptions>;
  if (keys.length === 0) return '';
  const parts = keys.map((k) => {
    const v = options[k];
    return `${k}: ${formatLiteral(v)}`;
  });
  return `{ ${parts.join(', ')} }`;
};

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Emit a single-quoted JS string literal — matches the codebase style. */
const stringLiteral = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

const formatLiteral = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return stringLiteral(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[${value.map(formatLiteral).join(', ')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([k, v]) => `${IDENT_RE.test(k) ? k : stringLiteral(k)}: ${formatLiteral(v)}`,
    );
    return `{ ${entries.join(', ')} }`;
  }
  return String(value);
};

const indent = (lines: string[], depth = 0): string =>
  lines.map((l) => (l === '' ? '' : '  '.repeat(depth) + l)).join('\n');

export type DumpSchemaOptions = {
  /** Migration version that produced this schema (used in the file header). */
  version?: string;
  /** Override the import specifier used at the top of the generated file. */
  importFrom?: string;
};

/** Build the schema.ts source text from the current database state. */
export const dumpSchemaSource = async (
  adapter: ConnectionAdapter,
  options: DumpSchemaOptions = {},
): Promise<string> => {
  const tables = await adapter.tables();
  const sections: string[] = [];

  for (const tableName of tables) {
    const cols = await adapter.columns(tableName);
    const pkName = (await adapter.primaryKey(tableName)) ?? 'id';
    const idxs = await adapter.indexes(tableName);
    const fks = await adapter.foreignKeys(tableName);

    sections.push(...emitCreateTable(adapter.adapterName, tableName, cols, pkName));
    for (const idx of idxs) {
      if (matchesAutoIndex(tableName, idx)) continue;
      sections.push(emitAddIndex(tableName, idx));
    }
    for (const fk of fks) sections.push(emitAddForeignKey(fk));
    sections.push('');
  }

  while (sections.length > 0 && sections[sections.length - 1] === '') sections.pop();

  const versionLine = options.version ? `export const version = ${stringLiteral(options.version)};\n\n` : '';

  const importFrom = options.importFrom ?? '@arelts/active-record';
  return (
    `/* eslint-disable */\n` +
    `// Auto-generated by @arelts/active-record. Do not edit by hand.\n` +
    `// This file is the source of truth for the database schema; loading\n` +
    `// it (via \`db:schema:load\`) recreates the database from scratch.\n\n` +
    `import { defineSchema } from ${stringLiteral(importFrom)};\n\n` +
    versionLine +
    `export default defineSchema((s) => {\n` +
    indent(sections, 1) +
    `\n});\n`
  );
};

/** Default `index_<table>_on_<cols>` matches what `addIndex` would auto-generate. */
const matchesAutoIndex = (tableName: string, idx: IndexInfo): boolean => {
  const auto = `index_${tableName}_on_${idx.columns.join('_and_')}`;
  return idx.name === auto && !idx.unique;
};

const emitCreateTable = (
  adapterName: string,
  tableName: string,
  cols: ColumnInfo[],
  pkName: string,
): string[] => {
  const lines: string[] = [];
  const pkOpt = pkName === 'id' ? '' : `, { primaryKey: ${stringLiteral(pkName)} }`;
  lines.push(`s.createTable(${stringLiteral(tableName)}, (t) => {`);
  for (const col of cols) {
    if (col.name === pkName && col.isPrimaryKey) continue;
    const { type, options } = inferColumn(adapterName, col);
    const opts = stringifyOptions(options);
    const optsStr = opts ? `, ${opts}` : '';
    lines.push(`  t.column(${stringLiteral(col.name)}, ${stringLiteral(type)}${optsStr});`);
  }
  lines.push(pkOpt ? `}${pkOpt});` : `});`);
  return lines;
};

const emitAddIndex = (tableName: string, idx: IndexInfo): string => {
  const opts: Record<string, unknown> = { name: idx.name };
  if (idx.unique) opts.unique = true;
  return `s.addIndex(${stringLiteral(tableName)}, ${formatLiteral(idx.columns)}, ${formatLiteral(opts)});`;
};

const emitAddForeignKey = (fk: ForeignKeyInfo): string => {
  const opts: Record<string, unknown> = { column: fk.column, primaryKey: fk.primaryKey, name: fk.name };
  if (fk.onDelete) opts.onDelete = fk.onDelete;
  if (fk.onUpdate) opts.onUpdate = fk.onUpdate;
  return `s.addForeignKey(${stringLiteral(fk.fromTable)}, ${stringLiteral(fk.toTable)}, ${formatLiteral(opts)});`;
};
