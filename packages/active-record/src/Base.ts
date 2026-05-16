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
import { Model, lookupType, tableize, type Type, type TypeRef } from '@arelts/active-model';
import type { ConnectionAdapter } from './ConnectionAdapter';
import { getConnection, setConnection } from './connection';
import { buildAdapter } from './adapters';
import type { ColumnInfo, ConnectionConfig } from './types';
import { Relation, RecordNotFound } from './Relation';
import { buildPredicate, type WhereInput } from './predicates';
import {
  defineAssociationAccessor,
  registerAssociation,
  registerPolymorphicClass,
  type AssociationReflection,
  type BelongsToOptions,
  type HasManyOptions,
  type HasOneOptions,
} from './associations';
import { pluralize } from '@arelts/active-model';

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

/**
 * Adapter-supplied column defaults arrive as either SQL fragments
 * (`"0"`, `"'pending'"`, `"CURRENT_TIMESTAMP"`) or raw values, depending
 * on the dialect. We unwrap quoted scalars, ignore function-call defaults
 * (the database will fill them on INSERT), and pass everything else
 * through the type's caster.
 */
const normalizeColumnDefault = (raw: unknown, type: Type): unknown => {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'number' || typeof raw === 'boolean' || typeof raw === 'bigint') return type.cast(raw);
  if (raw instanceof Date) return type.cast(raw);
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    // Identify SQL function calls (e.g. CURRENT_TIMESTAMP, nextval(...), now()).
    if (/^[a-zA-Z][a-zA-Z0-9_]*\s*\(/.test(trimmed)) return undefined;
    const upper = trimmed.toUpperCase();
    if (upper === 'CURRENT_TIMESTAMP' || upper === 'NULL') return undefined;
    // SQLite emits boolean literals as `TRUE`/`FALSE` even when the column
    // is INTEGER. Coerce to 1/0 so integer types can absorb them.
    if (upper === 'TRUE') return type.cast(1);
    if (upper === 'FALSE') return type.cast(0);
    // Unwrap a quoted scalar (`'foo'` -> `foo`) and PG type-casts (`'foo'::text`).
    let unquoted = trimmed;
    const castIdx = unquoted.search(/::/);
    if (castIdx > 0) unquoted = unquoted.slice(0, castIdx);
    if (unquoted.length >= 2 && unquoted.startsWith("'") && unquoted.endsWith("'")) {
      unquoted = unquoted.slice(1, -1).replace(/''/g, "'");
    }
    return type.cast(unquoted);
  }
  return type.cast(raw);
};

/** Camelize a snake_case attribute name for method naming (`first_name` -> `FirstName`). */
const camelizeMethodSuffix = (name: string): string =>
  name.replace(/(?:^|[_-])([a-z0-9])/gi, (_, c: string) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '');

/**
 * Install dynamic finder methods on the model constructor:
 * `User.findByName(value)` resolves to `User.findBy({ name: value })`, and
 * `findByNameOrThrow(value)` throws `RecordNotFound` when nothing matches.
 */
const defineDynamicFinders = (ctor: typeof Base, attribute: string): void => {
  const suffix = camelizeMethodSuffix(attribute);
  const findName = `findBy${suffix}`;
  const findNameOrThrow = `${findName}OrThrow`;
  if (!Object.prototype.hasOwnProperty.call(ctor, findName)) {
    Object.defineProperty(ctor, findName, {
      configurable: true,
      writable: true,
      value: async function (this: typeof Base, value: unknown) {
        return this.findBy({ [attribute]: value } as never);
      },
    });
  }
  if (!Object.prototype.hasOwnProperty.call(ctor, findNameOrThrow)) {
    Object.defineProperty(ctor, findNameOrThrow, {
      configurable: true,
      writable: true,
      value: async function (this: typeof Base, value: unknown) {
        const record = await this.findBy({ [attribute]: value } as never);
        if (!record) {
          throw new RecordNotFound(`Couldn't find ${this.name} with ${attribute}=${String(value)}`);
        }
        return record;
      },
    });
  }
};

/**
 * Infer the FK column on the owned side from the declaring class name.
 * `User` -> `user_id`, `BlogPost` -> `blog_post_id`. Matches Rails'
 * default naming.
 */
const inferForeignKeyFor = (ctor: { name: string }): string => {
  const snake = ctor.name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase();
  return `${snake}_id`;
};

/** Apply a has_many/has_one `dependent:` action when the owner is being destroyed. */
const applyDependent = async (owner: Base, reflection: AssociationReflection): Promise<void> => {
  const id = owner.readAttribute(reflection.primaryKey);
  if (id == null) return;
  const klass = reflection.classRef ? reflection.classRef() : null;
  if (!klass) return;
  const conditions: Record<string, unknown> = { [reflection.foreignKey]: id };
  if (reflection.as) conditions[`${reflection.as}_type`] = owner.constructor.name;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic call on subclass
  const Cls = klass as any;
  switch (reflection.dependent) {
    case 'destroy': {
      const records = await Cls.where(conditions).toArray();
      for (const r of records) await r.destroy();
      return;
    }
    case 'delete_all':
      await Cls.deleteAll(conditions);
      return;
    case 'nullify': {
      const update: Record<string, unknown> = { [reflection.foreignKey]: null };
      if (reflection.as) update[`${reflection.as}_type`] = null;
      await Cls.updateAll(update, conditions);
      return;
    }
  }
};

// `pluralize` is imported above to keep us tree-shake-friendly; suppress the
// unused-import warning when it's only referenced by JSDoc samples.
void pluralize;

/**
 * Stack of pending transaction queues. Each entry collects callbacks
 * registered by records that were saved/destroyed inside that
 * transaction. The top of the stack is the innermost transaction; when
 * the OUTERMOST transaction commits we run its commit callbacks. When
 * any transaction rolls back we discard its commit callbacks and run
 * the rollback ones instead.
 */
type TxQueue = { onCommit: Array<() => Promise<void> | void>; onRollback: Array<() => Promise<void> | void> };
const transactionStack: TxQueue[] = [];

const enqueueOnCommit = (fn: () => Promise<void> | void): void => {
  // Callers must check `transactionStack.length` themselves when they need
  // the no-tx fast path (so they can await directly). This helper only
  // enqueues onto an open transaction.
  if (transactionStack.length === 0) return;
  transactionStack[transactionStack.length - 1]!.onCommit.push(fn);
};

const enqueueOnRollback = (fn: () => Promise<void> | void): void => {
  if (transactionStack.length === 0) return;
  transactionStack[transactionStack.length - 1]!.onRollback.push(fn);
};

/** Symbol key for cached per-class state attached to constructors. */
const ARSTATE = Symbol.for('@arelts/active-record:state');

type ClassState = {
  arelTable: Arel.Table | null;
  schemaLoaded: boolean;
  /** Attribute names that may be set on create but never updated thereafter. */
  readonlyAttributes: Set<string>;
};

const getState = (ctor: typeof Base): ClassState => {
  if (Object.prototype.hasOwnProperty.call(ctor, ARSTATE)) {
    return (ctor as unknown as { [ARSTATE]: ClassState })[ARSTATE];
  }
  // Walk the prototype chain so subclasses inherit then snapshot.
  const parent = Object.getPrototypeOf(ctor) as typeof Base | null;
  const parentState =
    parent && parent !== (Function.prototype as unknown as typeof Base) && parent.name
      ? getState(parent)
      : null;
  const state: ClassState = {
    arelTable: null,
    schemaLoaded: false,
    readonlyAttributes: new Set(parentState?.readonlyAttributes),
  };
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

  // ──────────────────────────── associations ────────────────────────────

  /**
   * Declare a `belongs_to` association. The FK column lives on this
   * class; the accessor returns `Promise<Target | null>`.
   *
   *   class Post extends Base {}
   *   Post.belongsTo('user', { class: () => User });
   *   // post.user resolves to a User or null based on post.user_id.
   *
   * Pass `polymorphic: true` to add a `${name}_type` column reference
   * and resolve the target via `Base.polymorphicAs(...)` at access time.
   */
  static belongsTo<This extends typeof Base>(this: This, name: string, options: BelongsToOptions = {}): This {
    const foreignKey = options.foreignKey ?? `${name}_id`;
    const reflection: AssociationReflection = {
      kind: 'belongs_to',
      name,
      classRef: options.class ?? null,
      foreignKey,
      primaryKey: options.primaryKey ?? 'id',
      polymorphic: !!options.polymorphic,
      foreignType: options.polymorphic ? `${name}_type` : undefined,
      optional: options.optional ?? true,
    };
    registerAssociation(this, reflection);
    defineAssociationAccessor(this as unknown as typeof Base, reflection);
    return this;
  }

  /**
   * Declare a `has_many` association. The FK column lives on the OWNED
   * (target) class; the accessor returns a chainable `Relation<Target>`.
   *
   *   class User extends Base {}
   *   User.hasMany('posts', { class: () => Post });
   *   // user.posts is a Relation<Post> filtered by user_id = user.id.
   */
  static hasMany<This extends typeof Base>(this: This, name: string, options: HasManyOptions = {}): This {
    const targetCtor = options.class?.();
    const inferredFk = inferForeignKeyFor(this);
    const reflection: AssociationReflection = {
      kind: 'has_many',
      name,
      classRef: options.class ?? null,
      foreignKey: options.foreignKey ?? (options.as ? `${options.as}_id` : inferredFk),
      primaryKey: options.primaryKey ?? this.primaryKey,
      polymorphic: false,
      as: options.as,
      optional: true,
      dependent: options.dependent,
    };
    registerAssociation(this, reflection);
    defineAssociationAccessor(this as unknown as typeof Base, reflection);
    if (targetCtor && options.dependent) {
      // Hook a destroy callback to enforce :dependent at owner-destroy time.
      this.beforeDestroy(async (record) => {
        await applyDependent(record, reflection);
      });
    }
    return this;
  }

  /**
   * Declare a `has_one` association — the inverse of a single
   * `belongs_to`. Returns `Promise<Target | null>`.
   */
  static hasOne<This extends typeof Base>(this: This, name: string, options: HasOneOptions = {}): This {
    const inferredFk = inferForeignKeyFor(this);
    const reflection: AssociationReflection = {
      kind: 'has_one',
      name,
      classRef: options.class ?? null,
      foreignKey: options.foreignKey ?? (options.as ? `${options.as}_id` : inferredFk),
      primaryKey: options.primaryKey ?? this.primaryKey,
      polymorphic: false,
      as: options.as,
      optional: true,
      dependent: options.dependent,
    };
    registerAssociation(this, reflection);
    defineAssociationAccessor(this as unknown as typeof Base, reflection);
    if (options.class && options.dependent) {
      this.beforeDestroy(async (record) => {
        await applyDependent(record, reflection);
      });
    }
    return this;
  }

  /**
   * Register a polymorphic class name → class mapping. Called once per
   * class that participates in a polymorphic `belongs_to`. Default name
   * is the class name verbatim (Rails uses the class's `to_s`).
   */
  static polymorphicAs<This extends typeof Base>(this: This, typeName: string = this.name): This {
    registerPolymorphicClass(typeName, this as unknown as BaseConstructor);
    return this;
  }

  /**
   * Mark one or more attributes as read-only. Mirrors Rails'
   * `attr_readonly`. Readonly attributes are written on INSERT but never
   * updated, even if the value changes in memory.
   */
  static attrReadonly<This extends typeof Base>(this: This, ...names: string[]): This {
    const state = getState(this);
    for (const name of names) state.readonlyAttributes.add(name);
    return this;
  }

  /** True when `name` is marked read-only on this class (or any ancestor). */
  static isReadonlyAttribute(name: string): boolean {
    return getState(this).readonlyAttributes.has(name);
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

  /**
   * Override Model.attribute so dynamic finders are auto-generated alongside
   * the attribute accessor. Users who call `User.attribute('name', 'string')`
   * directly get `User.findByName(...)` for free.
   */
  static override attribute<This extends typeof Model>(
    this: This,
    name: string,
    type: TypeRef,
    options?: { default?: unknown },
  ): This {
    const result = (Model.attribute as (this: This, name: string, type: TypeRef, options?: { default?: unknown }) => This).call(this, name, type, options);
    defineDynamicFinders(this as unknown as typeof Base, name);
    return result;
  }

  /** Register a single column as an attribute (used by loadSchema and tests). */
  static attributeFromColumn(col: ColumnInfo): void {
    let type: Type;
    try {
      type = lookupType(col.type);
    } catch {
      type = lookupType('value');
    }
    const defaultValue = normalizeColumnDefault(col.default, type);
    if (defaultValue === undefined) {
      this.attribute(col.name, type);
    } else {
      this.attribute(col.name, type, { default: defaultValue });
    }
    defineDynamicFinders(this, col.name);
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

  static all<This extends typeof Base>(this: This): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>);
  }

  static where<This extends typeof Base>(
    this: This,
    input: WhereInput<InstanceType<This>>,
  ): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).where(input);
  }

  static order<This extends typeof Base>(
    this: This,
    ...orders: Parameters<Relation<InstanceType<This>>['order']>
  ): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).order(...orders);
  }

  static limit<This extends typeof Base>(this: This, n: number): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).limit(n);
  }

  static offset<This extends typeof Base>(this: This, n: number): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).offset(n);
  }

  static select<This extends typeof Base>(
    this: This,
    ...projections: Parameters<Relation<InstanceType<This>>['select']>
  ): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).select(...projections);
  }

  static distinct<This extends typeof Base>(this: This, value = true): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).distinct(value);
  }

  static none<This extends typeof Base>(this: This): Relation<InstanceType<This>> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).none();
  }

  static async find<This extends typeof Base>(this: This, ids: readonly unknown[]): Promise<InstanceType<This>[]>;
  static async find<This extends typeof Base>(this: This, id: unknown): Promise<InstanceType<This>>;
  static async find<This extends typeof Base>(this: This, ...ids: unknown[]): Promise<InstanceType<This>[]>;
  static async find<This extends typeof Base>(this: This, idOrIds: unknown, ...rest: unknown[]): Promise<InstanceType<This> | InstanceType<This>[]> {
    const relation = new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>);
    if (rest.length > 0) return relation.find([idOrIds, ...rest]);
    return relation.find(idOrIds as never);
  }

  static async findBy<This extends typeof Base>(
    this: This,
    input: WhereInput<InstanceType<This>>,
  ): Promise<InstanceType<This> | null> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).findBy(input);
  }

  static async first<This extends typeof Base>(this: This): Promise<InstanceType<This> | null> {
    return (await new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).first()) as
      | InstanceType<This>
      | null;
  }

  static async last<This extends typeof Base>(this: This): Promise<InstanceType<This> | null> {
    return (await new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).last()) as
      | InstanceType<This>
      | null;
  }

  static async take<This extends typeof Base>(
    this: This,
    n?: number,
  ): Promise<InstanceType<This> | InstanceType<This>[] | null> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).take(n);
  }

  static async count(column?: string): Promise<number> {
    const result = await new Relation(this as unknown as BaseConstructor<Base>).count(column);
    return result as number;
  }

  static async sum(column: string): Promise<number> {
    const result = await new Relation(this as unknown as BaseConstructor<Base>).sum(column);
    return result as number;
  }

  static async minimum(column: string): Promise<number | null> {
    const result = await new Relation(this as unknown as BaseConstructor<Base>).minimum(column);
    return result as number | null;
  }

  static async maximum(column: string): Promise<number | null> {
    const result = await new Relation(this as unknown as BaseConstructor<Base>).maximum(column);
    return result as number | null;
  }

  static async average(column: string): Promise<number | null> {
    const result = await new Relation(this as unknown as BaseConstructor<Base>).average(column);
    return result as number | null;
  }

  static async exists<This extends typeof Base>(
    this: This,
    input?: WhereInput<InstanceType<This>>,
  ): Promise<boolean> {
    return new Relation<InstanceType<This>>(this as unknown as BaseConstructor<InstanceType<This>>).exists(input);
  }

  static async pluck<R = unknown>(this: typeof Base, ...columns: string[]): Promise<R[]> {
    return new Relation(this as unknown as BaseConstructor<Base>).pluck<R>(...columns);
  }

  static async ids(this: typeof Base): Promise<unknown[]> {
    return new Relation(this as unknown as BaseConstructor<Base>).ids();
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

  /**
   * Find a record matching `conditions`; if none exists, build (but don't
   * save) a new one with the matching attributes merged with `overrides`.
   * Mirrors Rails' `find_or_initialize_by`.
   */
  static async findOrInitializeBy<This extends typeof Base>(
    this: This,
    conditions: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ): Promise<InstanceType<This>> {
    const existing = await (this as unknown as typeof Base).findBy(conditions as never);
    if (existing) return existing as InstanceType<This>;
    const Ctor = this as unknown as new (values?: Record<string, unknown>) => InstanceType<This>;
    return new Ctor({ ...conditions, ...overrides });
  }

  /**
   * Find a record matching `conditions`; if none exists, create one with
   * the matching attributes merged with `overrides`. Mirrors Rails'
   * `find_or_create_by`. Returns the record even when validation fails
   * (caller can inspect `record.errors`).
   */
  static async findOrCreateBy<This extends typeof Base>(
    this: This,
    conditions: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ): Promise<InstanceType<This>> {
    const record = await (this as unknown as typeof Base).findOrInitializeBy(conditions, overrides);
    if (!record.persisted) await record.save();
    return record as InstanceType<This>;
  }

  /** `findOrCreateBy` but throws `RecordInvalid` when validation fails. */
  static async findOrCreateByOrThrow<This extends typeof Base>(
    this: This,
    conditions: Record<string, unknown>,
    overrides: Record<string, unknown> = {},
  ): Promise<InstanceType<This>> {
    const record = await (this as unknown as typeof Base).findOrInitializeBy(conditions, overrides);
    if (!record.persisted) await record.saveOrThrow();
    return record as InstanceType<This>;
  }

  /** Bulk delete via a single DELETE statement. Returns rows affected. */
  static async deleteAll<This extends typeof Base>(
    this: This,
    input?: WhereInput<InstanceType<This>>,
  ): Promise<number> {
    const table = this.arelTable();
    const dm = new Arel.DeleteManager(table);
    if (input !== undefined) {
      dm.where(buildPredicate(this as unknown as BaseConstructor<InstanceType<This>>, input, false));
    }
    const [sql, binds] = this.connection().toSql(dm);
    const result = await this.connection().exec(sql, binds);
    return result.rowsAffected;
  }

  /** Bulk update via UPDATE statement. */
  static async updateAll<This extends typeof Base>(
    this: This,
    values: Record<string, unknown>,
    input?: WhereInput<InstanceType<This>>,
  ): Promise<number> {
    const table = this.arelTable();
    const um = new Arel.UpdateManager(table);
    const pairs: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(values)) {
      pairs[name] = new ArelNodes.BindParam(value as never);
    }
    um.set(pairs as never);
    if (input !== undefined) {
      um.where(buildPredicate(this as unknown as BaseConstructor<InstanceType<This>>, input, false));
    }
    const [sql, binds] = this.connection().toSql(um);
    const result = await this.connection().exec(sql, binds);
    return result.rowsAffected;
  }

  /** Per-record destroy in a transaction. */
  static async destroyAll<This extends typeof Base>(
    this: This,
    input?: WhereInput<InstanceType<This>>,
  ): Promise<InstanceType<This>[]> {
    const ctor = this as unknown as BaseConstructor<InstanceType<This>>;
    const scope = input === undefined ? new Relation<InstanceType<This>>(ctor) : new Relation<InstanceType<This>>(ctor).where(input);
    const records = await scope.toArray();
    for (const r of records) await r.destroy();
    return records;
  }

  /**
   * Find records by primary-key list, then call `destroy()` on each (so
   * callbacks fire). Mirrors Rails' `Model.destroy([1, 2, 3])`. Returns
   * the destroyed records. Raises `RecordNotFound` if any id is missing.
   */
  static async destroy<This extends typeof Base>(
    this: This,
    ids: unknown | readonly unknown[],
  ): Promise<InstanceType<This> | InstanceType<This>[]> {
    const list = Array.isArray(ids) ? (ids as readonly unknown[]) : [ids];
    const records = await (this as unknown as typeof Base).find(list as readonly unknown[]) as InstanceType<This>[];
    for (const r of records) await r.destroy();
    return Array.isArray(ids) ? records : records[0]!;
  }

  /**
   * Issue a single DELETE for the given primary-key list. Skips callbacks
   * and validations — mirrors Rails' `Model.delete([1, 2, 3])`. Returns
   * the number of rows affected.
   */
  static async delete<This extends typeof Base>(
    this: This,
    ids: unknown | readonly unknown[],
  ): Promise<number> {
    const list = Array.isArray(ids) ? (ids as readonly unknown[]) : [ids];
    return (this as unknown as typeof Base).deleteAll({ [this.primaryKey]: list } as never);
  }

  static async transaction<T>(this: typeof Base, fn: (tx: ConnectionAdapter) => Promise<T>): Promise<T> {
    const queue: TxQueue = { onCommit: [], onRollback: [] };
    transactionStack.push(queue);
    try {
      const result = await this.connection().transaction(async (adapter) => fn(adapter));
      // Move our commit callbacks to the parent queue (if any) so they fire
      // only once the OUTERMOST transaction commits. If we're the outermost,
      // run them now.
      transactionStack.pop();
      if (transactionStack.length > 0) {
        const parent = transactionStack[transactionStack.length - 1]!;
        parent.onCommit.push(...queue.onCommit);
        parent.onRollback.push(...queue.onRollback);
      } else {
        for (const cb of queue.onCommit) await cb();
      }
      return result;
    } catch (err) {
      transactionStack.pop();
      for (const cb of queue.onRollback) {
        try { await cb(); } catch { /* swallow secondary errors */ }
      }
      throw err;
    }
  }

  // ──────────────────────────── instance persistence ────────────────────────────

  /**
   * Save the record. Returns false on validation failure; throws on DB errors.
   * On success, marks the record persisted and clears dirty state.
   */
  async save(): Promise<boolean> {
    const ctor = this.constructor as typeof Base;
    const wasNew = this.newRecord;
    if (!(await this.validate(wasNew ? 'create' : 'update'))) return false;
    let inner = false;
    const outer = await ctor.runCallbacks('save', this, async () => {
      inner = await ctor.runCallbacks(wasNew ? 'create' : 'update', this, async () => {
        if (wasNew) await this.insertRecord();
        else await this.updateRecord();
      });
    });
    if (outer && inner) await this.queueTransactionalCallbacks(wasNew ? 'create' : 'update');
    return outer && inner;
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
    await this.queueTransactionalCallbacks('destroy');
    return this;
  }

  /**
   * Reload this record from the database holding a row lock. Mirrors
   * Rails' `record.lock!`. Must be invoked inside a transaction — the
   * lock is held until the transaction commits or rolls back.
   */
  async lockOrThrow(lockClause: string | true = true): Promise<this> {
    const ctor = this.constructor as typeof Base;
    if (ctor.connection() == null) throw new Error('No connection established');
    const id = this.readAttribute(ctor.primaryKey);
    if (id == null) throw new RecordNotFound(`Cannot lock an unsaved ${ctor.name}`);
    const row = await new Relation(ctor as unknown as BaseConstructor<this>)
      .where({ [ctor.primaryKey]: id } as never)
      .lock(lockClause)
      .take();
    if (!row) throw new RecordNotFound(`Couldn't find ${ctor.name} with ${ctor.primaryKey}=${String(id)}`);
    // biome-ignore lint/suspicious/noExplicitAny: protected hydrate
    (this as any)._attributes.hydrate((row as Base).attributes());
    return this;
  }

  /**
   * Reload this record under a row-level lock inside a fresh transaction,
   * yield to `fn`, then commit. Mirrors Rails' `record.with_lock { ... }`.
   */
  async withLock<R>(fn: (record: this) => Promise<R>, lockClause: string | true = true): Promise<R> {
    const ctor = this.constructor as typeof Base;
    return ctor.transaction(async () => {
      await this.lockOrThrow(lockClause);
      return fn(this);
    });
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

  /**
   * Add `by` (default 1) to a numeric attribute. The change is in memory
   * only — call `save()` or use `incrementSave()` to persist. Mirrors
   * Rails' `record.increment(:counter)`.
   */
  increment(attribute: string, by: number = 1): this {
    const current = this.readAttribute(attribute);
    const base = typeof current === 'number' ? current : Number(current ?? 0);
    this.writeAttribute(attribute, base + by);
    return this;
  }

  /** Persist the increment via a single UPDATE. Skips dirty diff. */
  async incrementSave(attribute: string, by: number = 1): Promise<this> {
    this.increment(attribute, by);
    if (this._persisted) await this.save();
    return this;
  }

  /** Mirror of `increment` but subtracts. */
  decrement(attribute: string, by: number = 1): this {
    return this.increment(attribute, -by);
  }

  async decrementSave(attribute: string, by: number = 1): Promise<this> {
    return this.incrementSave(attribute, -by);
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
    const changed = this.changed().filter((name) => !ctor.isReadonlyAttribute(name));
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

  /**
   * Push this record's `after_commit` / `after_rollback` callbacks onto
   * the active transaction queue (or run `after_commit` immediately when
   * not inside one). Filtering by `on: 'create' | 'update' | 'destroy'`
   * is applied at fire time via the callback chain's context filter.
   */
  private async queueTransactionalCallbacks(context: 'create' | 'update' | 'destroy'): Promise<void> {
    const ctor = this.constructor as typeof Base;
    if (transactionStack.length === 0) {
      await ctor.runCallbacks('commit', this, async () => { /* no-op body */ }, context);
      return;
    }
    enqueueOnCommit(async () => {
      await ctor.runCallbacks('commit', this, async () => { /* no-op body */ }, context);
    });
    enqueueOnRollback(async () => {
      await ctor.runCallbacks('rollback', this, async () => { /* no-op body */ }, context);
    });
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
