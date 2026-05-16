/**
 * ActiveRecord::Base equivalent. Subclasses use class-level configuration
 * (table name, primary key, attributes) plus a per-class adapter to power
 * a chainable `Relation` API and full CRUD persistence.
 *
 * Subclasses typically look like:
 *
 *   class User extends ActiveRecord.Base {
 *     static override tableName = 'users';
 *     declare id: number;
 *     declare name: string;
 *   }
 *   await User.establishConnection({ adapter: 'sqlite', database: ':memory:' });
 *   await User.loadSchema();
 *   const u = await User.create({ name: 'Alex' });
 *
 * Most surface mirrors Rails:
 *   - finders: `find`, `findBy`, `first`, `last`, `where`, `order`, ...
 *   - persistence: `create`, `save`, `update`, `destroy`, `updateAll`, ...
 *   - validations / callbacks: inherited from `Model` (active-model).
 */

import { Arel, Nodes as ArelNodes } from '@arelts/arel';
import type { Attribute as ArelAttribute, BindParamNode } from '@arelts/arel';
import { Model, lookupType, tableize, type Type } from '@arelts/active-model';
import type { ConnectionAdapter } from './ConnectionAdapter';
import { getConnection, setConnection } from './connection';
import { buildAdapter } from './adapters';
import type { ColumnInfo, ConnectionConfig } from './types';
import { Relation, RecordNotFound } from './Relation';
import { buildPredicate, type WhereInput } from './predicates';

/** Thrown when `save!` fails validation. */
export class RecordInvalid extends Error {
  constructor(public record: Base) {
    super(`Validation failed: ${record.errors.fullMessages.join(', ')}`);
  }
}

export class RecordNotSaved extends Error {
  constructor(message: string) {
    super(message);
  }
}

export { RecordNotFound };

/**
 * Phantom type for the class side of a `Base` subclass. Lets us reference
 * `BaseConstructor<T>` in cross-module type definitions without an `any`.
 */
export type BaseConstructor<T extends Base = Base> = {
  new (values?: Record<string, unknown>): T;
  tableName: string;
  primaryKey: string;
  connection(): ConnectionAdapter;
  arelTable(): Arel.Table;
  instantiate(row: Record<string, unknown>): T;
  attributesSchema(): ReturnType<typeof Model.attributesSchema>;
};

/** Symbol key for cached per-class state attached to constructors. */
const ARSTATE = Symbol.for('@arelts/active-record:state');

type ClassState = {
  arelTable: Arel.Table | null;
  schemaLoaded: boolean;
};

const getState = (ctor: typeof Base): ClassState => {
  if (Object.prototype.hasOwnProperty.call(ctor, ARSTATE)) {
    return (ctor as unknown as { [ARSTATE]: ClassState })[ARSTATE];
  }
  const state: ClassState = { arelTable: null, schemaLoaded: false };
  Object.defineProperty(ctor, ARSTATE, { value: state, enumerable: false, configurable: true, writable: false });
  return state;
};

export class Base extends Model {
  /** Table name. Defaults to a Rails-style pluralization of the class name. */
  static tableName: string | null = null;
  /** Primary key column name. */
  static primaryKey = 'id';

  /** True after `save` has been called and succeeded at least once. */
  declare protected _persisted: boolean;
  /** True after `destroy` has been called. */
  declare protected _destroyed: boolean;

  constructor(values: Record<string, unknown> = {}) {
    super(values);
    this._persisted = false;
    this._destroyed = false;
  }

  // ──────────────────────────── instance state ────────────────────────────

  get persisted(): boolean {
    return this._persisted && !this._destroyed;
  }
  get newRecord(): boolean {
    return !this._persisted;
  }
  get destroyed(): boolean {
    return this._destroyed;
  }

  /** ID (primary-key value) of this record. */
  get id(): unknown {
    return this.readAttribute((this.constructor as typeof Base).primaryKey);
  }

  // ──────────────────────────── class-level configuration ────────────────────────────

  /** Resolve the effective table name, using the inflector when unset. */
  static effectiveTableName(): string {
    if (typeof this.tableName === 'string' && this.tableName.length > 0) return this.tableName;
    return tableize(this.name);
  }

  /** Establish a connection for this class (and its subclasses). */
  static async establishConnection(config: ConnectionConfig): Promise<ConnectionAdapter> {
    const adapter = buildAdapter(config);
    await adapter.connect();
    setConnection(this, adapter);
    return adapter;
  }

  /** Manually assign an already-connected adapter. */
  static useConnection(adapter: ConnectionAdapter): void {
    setConnection(this, adapter);
  }

  /** Resolve the nearest configured adapter (walks the class chain). */
  static connection(): ConnectionAdapter {
    const adapter = getConnection(this);
    if (!adapter) throw new Error(`No connection established for ${this.name} — call ${this.name}.establishConnection(...)`);
    return adapter;
  }

  /** Disconnect this class's adapter. */
  static async disconnect(): Promise<void> {
    const adapter = getConnection(this);
    if (adapter) await adapter.disconnect();
  }

  /** Build the Arel table for this class, cached on the constructor. */
  static arelTable(): Arel.Table {
    const state = getState(this);
    if (!state.arelTable) state.arelTable = new Arel.Table(this.effectiveTableName());
    return state.arelTable;
  }

  /** Reflect columns from the DB and register attributes. */
  static async loadSchema(): Promise<void> {
    const conn = this.connection();
    const cols = await conn.columns(this.effectiveTableName());
    const pk = (await conn.primaryKey(this.effectiveTableName())) ?? this.primaryKey;
    this.primaryKey = pk;
    for (const col of cols) this.attributeFromColumn(col);
    getState(this).schemaLoaded = true;
  }

  /** Register a single column as an attribute (used by loadSchema and tests). */
  static attributeFromColumn(col: ColumnInfo): void {
    let type: Type;
    try {
      type = lookupType(col.type);
    } catch {
      type = lookupType('value');
    }
    this.attribute(col.name, type);
  }

  /** Instantiate a record from a database row, skipping dirty tracking. */
  static instantiate<T extends Base>(this: new (values?: Record<string, unknown>) => T, row: Record<string, unknown>): T {
    const record = new this();
    // Bypass write-time casting and dirty tracking — hydrate raw.
    // biome-ignore lint/suspicious/noExplicitAny: protected field access via constructor pattern
    (record as any)._attributes.hydrate(row);
    // biome-ignore lint/suspicious/noExplicitAny: protected field access
    (record as any)._persisted = true;
    return record;
  }

  // ──────────────────────────── query API ────────────────────────────

  static all<T extends Base>(this: BaseConstructor<T>): Relation<T> {
    return new Relation<T>(this);
  }

  static where<T extends Base>(this: BaseConstructor<T>, input: WhereInput<T>): Relation<T> {
    return new Relation<T>(this).where(input);
  }

  static order<T extends Base>(this: BaseConstructor<T>, ...orders: Parameters<Relation<T>['order']>): Relation<T> {
    return new Relation<T>(this).order(...orders);
  }

  static limit<T extends Base>(this: BaseConstructor<T>, n: number): Relation<T> {
    return new Relation<T>(this).limit(n);
  }

  static offset<T extends Base>(this: BaseConstructor<T>, n: number): Relation<T> {
    return new Relation<T>(this).offset(n);
  }

  static select<T extends Base>(this: BaseConstructor<T>, ...projections: Parameters<Relation<T>['select']>): Relation<T> {
    return new Relation<T>(this).select(...projections);
  }

  static distinct<T extends Base>(this: BaseConstructor<T>, value = true): Relation<T> {
    return new Relation<T>(this).distinct(value);
  }

  static none<T extends Base>(this: BaseConstructor<T>): Relation<T> {
    return new Relation<T>(this).none();
  }

  static async find<T extends Base>(this: BaseConstructor<T>, id: unknown): Promise<T> {
    return new Relation<T>(this).find(id);
  }

  static async findBy<T extends Base>(this: BaseConstructor<T>, input: WhereInput<T>): Promise<T | null> {
    return new Relation<T>(this).findBy(input);
  }

  static async first<T extends Base>(this: BaseConstructor<T>): Promise<T | null> {
    return (await new Relation<T>(this).first()) as T | null;
  }

  static async last<T extends Base>(this: BaseConstructor<T>): Promise<T | null> {
    return (await new Relation<T>(this).last()) as T | null;
  }

  static async take<T extends Base>(this: BaseConstructor<T>, n?: number): Promise<T | T[] | null> {
    return new Relation<T>(this).take(n);
  }

  static async count(column?: string): Promise<number> {
    return new Relation(this as unknown as BaseConstructor<Base>).count(column);
  }

  static async exists<T extends Base>(this: BaseConstructor<T>, input?: WhereInput<T>): Promise<boolean> {
    return new Relation<T>(this).exists(input);
  }

  static async pluck<T extends Base, R = unknown>(this: BaseConstructor<T>, ...columns: string[]): Promise<R[]> {
    return new Relation<T>(this).pluck<R>(...columns);
  }

  static async ids<T extends Base>(this: BaseConstructor<T>): Promise<unknown[]> {
    return new Relation<T>(this).ids();
  }

  // ──────────────────────────── class-level persistence ────────────────────────────

  /** Build (but don't save) a new record. */
  static build<T extends Base>(this: new (values?: Record<string, unknown>) => T, values: Record<string, unknown> = {}): T {
    return new this(values);
  }

  /** Create a record. Returns the (possibly unsaved) instance. */
  static async create<T extends Base>(this: new (values?: Record<string, unknown>) => T, values: Record<string, unknown> = {}): Promise<T> {
    const record = new this(values);
    await record.save();
    return record;
  }

  /** Create a record; throws `RecordInvalid` on validation failure. */
  static async createOrThrow<T extends Base>(this: new (values?: Record<string, unknown>) => T, values: Record<string, unknown> = {}): Promise<T> {
    const record = new this(values);
    await record.saveOrThrow();
    return record;
  }

  /** Bulk delete via a single DELETE statement. Returns rows affected. */
  static async deleteAll<T extends Base>(this: BaseConstructor<T>, input?: WhereInput<T>): Promise<number> {
    const table = this.arelTable();
    const dm = new Arel.DeleteManager(table);
    if (input !== undefined) dm.where(buildPredicate(this, input, false));
    const [sql, binds] = this.connection().toSql(dm);
    const result = await this.connection().exec(sql, binds);
    return result.rowsAffected;
  }

  /** Bulk update via UPDATE statement. */
  static async updateAll<T extends Base>(
    this: BaseConstructor<T>,
    values: Record<string, unknown>,
    input?: WhereInput<T>,
  ): Promise<number> {
    const table = this.arelTable();
    const um = new Arel.UpdateManager(table);
    const pairs: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(values)) {
      pairs[name] = new ArelNodes.BindParam(value as never);
    }
    um.set(pairs as never);
    if (input !== undefined) um.where(buildPredicate(this, input, false));
    const [sql, binds] = this.connection().toSql(um);
    const result = await this.connection().exec(sql, binds);
    return result.rowsAffected;
  }

  /** Per-record destroy in a transaction. */
  static async destroyAll<T extends Base>(this: BaseConstructor<T>, input?: WhereInput<T>): Promise<T[]> {
    const scope = input === undefined ? new Relation<T>(this) : new Relation<T>(this).where(input);
    const records = await scope.toArray();
    for (const r of records) await r.destroy();
    return records;
  }

  static async transaction<T>(this: typeof Base, fn: (tx: ConnectionAdapter) => Promise<T>): Promise<T> {
    return this.connection().transaction(async (adapter) => fn(adapter));
  }

  // ──────────────────────────── instance persistence ────────────────────────────

  /**
   * Save the record. Returns false on validation failure; throws on DB errors.
   * On success, marks the record persisted and clears dirty state.
   */
  async save(): Promise<boolean> {
    const ctor = this.constructor as typeof Base;
    if (!(await this.validate())) return false;
    let ran = true;
    await ctor.runCallbacks('save', this, async () => {
      ran = await ctor.runCallbacks(this.newRecord ? 'create' : 'update', this, async () => {
        if (this.newRecord) await this.insertRecord();
        else await this.updateRecord();
      });
    });
    return ran;
  }

  async saveOrThrow(): Promise<void> {
    const ok = await this.save();
    if (!ok) throw new RecordInvalid(this);
  }

  async update(values: Record<string, unknown>): Promise<boolean> {
    this.assignAttributes(values);
    return this.save();
  }

  async updateOrThrow(values: Record<string, unknown>): Promise<void> {
    this.assignAttributes(values);
    await this.saveOrThrow();
  }

  /** Delete this record from the DB. */
  async destroy(): Promise<this> {
    if (this._destroyed) return this;
    const ctor = this.constructor as typeof Base;
    await ctor.runCallbacks('destroy', this, async () => {
      if (this._persisted) {
        const table = ctor.arelTable();
        const pk = ctor.primaryKey;
        const dm = new Arel.DeleteManager(table);
        const id = this.readAttribute(pk);
        dm.where(table.attribute(pk).equal(new ArelNodes.BindParam(id as never)));
        const [sql, binds] = ctor.connection().toSql(dm);
        await ctor.connection().exec(sql, binds);
      }
      this._destroyed = true;
    });
    return this;
  }

  /** Re-read from the DB, replacing any in-memory changes. */
  async reload(): Promise<this> {
    const ctor = this.constructor as typeof Base;
    const id = this.readAttribute(ctor.primaryKey);
    if (id === null || id === undefined) {
      throw new RecordNotFound(`Cannot reload an unsaved ${ctor.name}`);
    }
    const row = await new Relation(ctor as unknown as BaseConstructor<this>).findBy({ [ctor.primaryKey]: id } as never);
    if (!row) throw new RecordNotFound(`Couldn't find ${ctor.name} with ${ctor.primaryKey}=${String(id)}`);
    // biome-ignore lint/suspicious/noExplicitAny: protected field rehydration
    (this as any)._attributes.hydrate(row.attributes());
    return this;
  }

  /** Update `updated_at` (and optionally other columns) without changing any business data. */
  async touch(...columns: string[]): Promise<this> {
    const now = new Date();
    const ctor = this.constructor as typeof Base;
    const targets = columns.length > 0 ? columns : ['updated_at', 'updatedAt'];
    const schema = ctor.attributesSchema();
    for (const c of targets) {
      if (schema.has(c)) this.writeAttribute(c, now);
    }
    if (this._persisted) await this.save();
    return this;
  }

  // ──────────────────────────── internals ────────────────────────────

  /** INSERT a brand-new row, then refresh `id` (and timestamps) from the row that came back. */
  private async insertRecord(): Promise<void> {
    const ctor = this.constructor as typeof Base;
    const conn = ctor.connection();
    const table = ctor.arelTable();
    const schema = ctor.attributesSchema();
    this.maybeStampTimestamps(true);

    const im = new Arel.InsertManager(table);
    const pairs: Array<[ArelAttribute, BindParamNode]> = [];
    for (const def of schema) {
      // Skip the primary key when its value is null/undefined so the DB can auto-generate it.
      const current = this.readAttribute(def.name);
      const isPk = def.name === ctor.primaryKey;
      if (isPk && (current === null || current === undefined)) continue;
      const serialized = def.type.serialize(current as never);
      pairs.push([table.attribute(def.name), new ArelNodes.BindParam(serialized as never)]);
    }
    if (pairs.length > 0) {
      im.insert(pairs as never);
    } else {
      // Emit `INSERT INTO ... DEFAULT VALUES` shape via a raw fragment.
      // Most dialects accept `()` empty values list; SQLite accepts DEFAULT VALUES.
      const [sqlEmpty] = conn.toSql(new Arel.InsertManager(table).into(table));
      const result = await conn.exec(sqlEmpty);
      this.captureInsertResult(result, ctor.primaryKey);
      return;
    }

    // Append RETURNING * for adapters that support it (PG, SQLite).
    let [sql, binds] = conn.toSql(im);
    if (conn.adapterName !== 'mysql' && !/\breturning\b/i.test(sql)) sql = `${sql} RETURNING *`;
    const result = await conn.exec(sql, binds);
    this.captureInsertResult(result, ctor.primaryKey);
  }

  /** Apply the result of an INSERT — hydrate from RETURNING or backfill from lastInsertId. */
  private captureInsertResult(result: { returning?: Record<string, unknown>[]; lastInsertId?: unknown }, pk: string): void {
    if (result.returning && result.returning[0]) {
      // biome-ignore lint/suspicious/noExplicitAny: protected field access
      (this as any)._attributes.hydrate(result.returning[0]);
    } else if (result.lastInsertId !== undefined && result.lastInsertId !== null) {
      this.writeAttribute(pk, result.lastInsertId);
    }
    this._persisted = true;
    // biome-ignore lint/suspicious/noExplicitAny: protected field
    (this as any)._attributes.commit();
  }

  /** UPDATE persisted record using its dirty diff. */
  private async updateRecord(): Promise<void> {
    const ctor = this.constructor as typeof Base;
    const conn = ctor.connection();
    const table = ctor.arelTable();
    const schema = ctor.attributesSchema();
    this.maybeStampTimestamps(false);
    const changed = this.changed();
    if (changed.length === 0) return;
    const um = new Arel.UpdateManager(table);
    const assignments: Record<string, BindParamNode> = {};
    for (const name of changed) {
      const def = schema.get(name);
      if (!def) continue;
      const serialized = def.type.serialize(this.readAttribute(name) as never);
      assignments[name] = new ArelNodes.BindParam(serialized as never);
    }
    um.set(assignments as never);
    const id = this.readAttribute(ctor.primaryKey);
    um.where(table.attribute(ctor.primaryKey).equal(new ArelNodes.BindParam(id as never)));
    const [sql, binds] = conn.toSql(um);
    await conn.exec(sql, binds);
    // biome-ignore lint/suspicious/noExplicitAny: protected field
    (this as any)._attributes.commit();
  }

  /** Stamp created_at/updated_at if the schema has them. */
  private maybeStampTimestamps(creating: boolean): void {
    const schema = (this.constructor as typeof Base).attributesSchema();
    const now = new Date();
    if (creating) {
      for (const c of ['created_at', 'createdAt']) {
        if (schema.has(c) && this.readAttribute(c) == null) this.writeAttribute(c, now);
      }
    }
    for (const c of ['updated_at', 'updatedAt']) {
      if (schema.has(c)) this.writeAttribute(c, now);
    }
  }
}
