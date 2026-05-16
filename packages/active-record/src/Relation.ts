/**
 * Lazy, chainable, thenable query builder. Mirrors Rails' `Relation`
 * surface — `where`, `order`, `limit`, etc. return new `Relation`s, while
 * terminal methods (`toArray`, `first`, `count`) materialize.
 *
 * State is held as plain arrays of arel `Expression` nodes; the final
 * `SelectManager` is built on demand from those slices when the relation
 * is executed.
 */

import { Arel, Nodes as ArelNodes } from '@arelts/arel';
import type { Attribute, Expression, SelectManager } from '@arelts/arel';
import { lookupAssociation } from './associations/registry';
import { preloadAssociation } from './associations/Preloader';

/** Clause names accepted by `unscope` — mirror Rails' VALID_UNSCOPING_VALUES. */
export type UnscopeName =
  | 'where'
  | 'order'
  | 'limit'
  | 'offset'
  | 'select'
  | 'group'
  | 'having'
  | 'distinct'
  | 'lock'
  | 'none';
import type { Base, BaseConstructor } from './Base';
import { buildPredicate, type WhereInput } from './predicates';

/** A value usable as an ORDER BY clause — attribute, ordering node, string, or pair. */
export type OrderInput =
  | string
  | Expression
  | Record<string, 'asc' | 'desc' | 'ASC' | 'DESC'>;

/** A value usable in SELECT. */
export type SelectInput = string | Expression;

/**
 * Internal mutable state. A relation is otherwise an immutable wrapper —
 * each chainable call returns a copy.
 */
type RelationState = {
  whereClauses: Expression[];
  orderValues: Expression[];
  groupValues: Expression[];
  havingClauses: Expression[];
  selectValues: Expression[];
  joinValues: Expression[];
  /** Association names registered via `includes()` / `preload()`. */
  preloadValues: string[];
  /** Association names registered via `joins()`. INNER JOIN. */
  joinAssociations: string[];
  /** Association names registered via `leftOuterJoins()`. LEFT OUTER JOIN. */
  leftJoinAssociations: string[];
  /** Association names registered via `eagerLoad()`. LEFT OUTER JOIN + result hydration via preload. */
  eagerLoadValues: string[];
  /** SQL comments appended via `annotate(...)`. */
  annotations: string[];
  /** When true, accessing an association that wasn't preloaded throws. */
  strictLoading: boolean;
  /** Tables registered via `references()` — informational for now. */
  referenceValues: string[];
  limitValue: number | null;
  offsetValue: number | null;
  distinctValue: boolean;
  lockValue: string | true | null;
  noneValue: boolean;
};

const emptyState = (): RelationState => ({
  whereClauses: [],
  orderValues: [],
  groupValues: [],
  havingClauses: [],
  selectValues: [],
  joinValues: [],
  preloadValues: [],
  joinAssociations: [],
  leftJoinAssociations: [],
  eagerLoadValues: [],
  annotations: [],
  strictLoading: false,
  referenceValues: [],
  limitValue: null,
  offsetValue: null,
  distinctValue: false,
  lockValue: null,
  noneValue: false,
});

const cloneState = (state: RelationState): RelationState => ({
  whereClauses: [...state.whereClauses],
  orderValues: [...state.orderValues],
  groupValues: [...state.groupValues],
  havingClauses: [...state.havingClauses],
  selectValues: [...state.selectValues],
  joinValues: [...state.joinValues],
  preloadValues: [...state.preloadValues],
  joinAssociations: [...state.joinAssociations],
  leftJoinAssociations: [...state.leftJoinAssociations],
  eagerLoadValues: [...state.eagerLoadValues],
  annotations: [...state.annotations],
  strictLoading: state.strictLoading,
  referenceValues: [...state.referenceValues],
  limitValue: state.limitValue,
  offsetValue: state.offsetValue,
  distinctValue: state.distinctValue,
  lockValue: state.lockValue,
  noneValue: state.noneValue,
});

export class Relation<T extends Base> implements PromiseLike<T[]> {
  /** The Base subclass this relation produces. */
  readonly klass: BaseConstructor<T>;
  /** The arel table for the class. */
  readonly table: Arel.Table;
  private state: RelationState;
  private loaded: T[] | null = null;

  constructor(klass: BaseConstructor<T>, state: RelationState = emptyState()) {
    this.klass = klass;
    this.table = klass.arelTable();
    this.state = state;
  }

  // ──────────────────────────── chainable builders ────────────────────────────

  private chain(mutator: (s: RelationState) => void): Relation<T> {
    const next = new Relation<T>(this.klass, cloneState(this.state));
    mutator(next.state);
    return next;
  }

  where(input: WhereInput<T>): Relation<T> {
    return this.chain((s) => s.whereClauses.push(buildPredicate(this.klass, input, false)));
  }

  whereNot(input: WhereInput<T>): Relation<T> {
    return this.chain((s) => s.whereClauses.push(buildPredicate(this.klass, input, true)));
  }

  order(...orders: OrderInput[]): Relation<T> {
    return this.chain((s) => {
      for (const o of orders) s.orderValues.push(...buildOrders(this.klass, o));
    });
  }

  reorder(...orders: OrderInput[]): Relation<T> {
    return this.chain((s) => {
      s.orderValues = [];
      for (const o of orders) s.orderValues.push(...buildOrders(this.klass, o));
    });
  }

  limit(n: number | null): Relation<T> {
    return this.chain((s) => {
      s.limitValue = n;
    });
  }

  offset(n: number | null): Relation<T> {
    return this.chain((s) => {
      s.offsetValue = n;
    });
  }

  select(...projections: SelectInput[]): Relation<T> {
    return this.chain((s) => {
      for (const p of projections) s.selectValues.push(typeof p === 'string' ? Arel.sql(p) : (p as Expression));
    });
  }

  group(...columns: SelectInput[]): Relation<T> {
    return this.chain((s) => {
      for (const c of columns) s.groupValues.push(typeof c === 'string' ? this.attr(c) : (c as Expression));
    });
  }

  having(input: WhereInput<T>): Relation<T> {
    return this.chain((s) => s.havingClauses.push(buildPredicate(this.klass, input, false)));
  }

  distinct(value = true): Relation<T> {
    return this.chain((s) => {
      s.distinctValue = value;
    });
  }

  lock(value: string | true = true): Relation<T> {
    return this.chain((s) => {
      s.lockValue = value;
    });
  }

  none(): Relation<T> {
    return this.chain((s) => {
      s.noneValue = true;
    });
  }

  /**
   * Eager-load one or more associations. After materialization, each
   * loaded record has the named associations populated in its cache —
   * subsequent `record.user` / `record.posts` reads don't re-query.
   *
   * Mirrors Rails' `Model.includes(...)`. For now we always preload via
   * separate batched IN queries; we don't analyze `where` for a JOIN-vs-
   * preload heuristic.
   */
  includes(...names: string[]): Relation<T> {
    return this.chain((s) => s.preloadValues.push(...names));
  }

  /** Alias for `includes` — always preloads via separate queries. */
  preload(...names: string[]): Relation<T> {
    return this.includes(...names);
  }

  /**
   * INNER JOIN one or more associations. Lets you `.where` on columns of
   * the joined table via raw SQL (no aliasing magic). Doesn't preload —
   * use `includes` for that.
   */
  joins(...names: string[]): Relation<T> {
    return this.chain((s) => s.joinAssociations.push(...names));
  }

  /**
   * LEFT OUTER JOIN one or more associations. Like `joins`, but rows
   * without a matching join are kept.
   */
  leftOuterJoins(...names: string[]): Relation<T> {
    return this.chain((s) => s.leftJoinAssociations.push(...names));
  }

  /**
   * Eager-load via LEFT OUTER JOIN + post-load preload. Mirrors Rails'
   * `eager_load` — useful when you need to `where` on the joined table
   * but still want the associations cached on each parent. We currently
   * implement this as a `leftOuterJoins(...) + preload(...)` shortcut.
   */
  eagerLoad(...names: string[]): Relation<T> {
    return this.chain((s) => {
      s.leftJoinAssociations.push(...names);
      s.eagerLoadValues.push(...names);
      s.preloadValues.push(...names);
    });
  }

  /**
   * Append a SQL comment to the generated query. Multiple calls
   * accumulate. Mirrors Rails' `annotate('reason: nightly job')`.
   */
  annotate(...comments: string[]): Relation<T> {
    return this.chain((s) => s.annotations.push(...comments));
  }

  /**
   * Mark this relation as strict-loading. Reading an association that
   * wasn't preloaded throws — useful for catching N+1 in development.
   * (Currently informational on the relation; per-record enforcement
   * is a follow-up.)
   */
  strictLoading(value = true): Relation<T> {
    return this.chain((s) => {
      s.strictLoading = value;
    });
  }

  /**
   * Inform the relation that a particular table is referenced by raw
   * SQL conditions, so eager-loading switches to LEFT OUTER JOIN even
   * without an explicit `eagerLoad` call. We currently record the
   * names — explicit `eagerLoad` / `leftOuterJoins` still drives the
   * SQL; this is here for parity.
   */
  references(...tableNames: string[]): Relation<T> {
    return this.chain((s) => s.referenceValues.push(...tableNames));
  }

  /**
   * Combine this relation with another via OR. Both must target the same
   * model class and must not contain incompatible clauses (groups / orders).
   * The resulting WHERE clause is `(this.wheres) OR (other.wheres)`.
   */
  or(other: Relation<T>): Relation<T> {
    if (other.klass !== this.klass) {
      throw new Error(`Relation#or expects a relation on ${this.klass.name}, got ${other.klass.name}`);
    }
    return this.chain((s) => {
      const left = collapseAnd(s.whereClauses);
      const right = collapseAnd(other.state.whereClauses);
      s.whereClauses = left && right ? [new ArelNodes.Or([left, right]) as unknown as Expression] : (left ? [left] : (right ? [right] : []));
    });
  }

  /**
   * Merge another relation's clauses into this one. Where/order/limit/etc.
   * are concatenated or overridden (later wins for limit/offset/distinct/
   * lock/none). Mirrors Rails' `Relation#merge`.
   */
  merge(other: Relation<T>): Relation<T> {
    if (other.klass !== this.klass) {
      throw new Error(`Relation#merge expects a relation on ${this.klass.name}, got ${other.klass.name}`);
    }
    return this.chain((s) => {
      s.whereClauses.push(...other.state.whereClauses);
      s.havingClauses.push(...other.state.havingClauses);
      s.orderValues.push(...other.state.orderValues);
      s.groupValues.push(...other.state.groupValues);
      s.selectValues.push(...other.state.selectValues);
      s.joinValues.push(...other.state.joinValues);
      if (other.state.limitValue != null) s.limitValue = other.state.limitValue;
      if (other.state.offsetValue != null) s.offsetValue = other.state.offsetValue;
      if (other.state.distinctValue) s.distinctValue = true;
      if (other.state.lockValue != null) s.lockValue = other.state.lockValue;
      if (other.state.noneValue) s.noneValue = true;
    });
  }

  /** Drop specific clauses from the relation. */
  unscope(...names: UnscopeName[]): Relation<T> {
    return this.chain((s) => {
      for (const name of names) {
        switch (name) {
          case 'where':    s.whereClauses = []; break;
          case 'order':    s.orderValues = []; break;
          case 'limit':    s.limitValue = null; break;
          case 'offset':   s.offsetValue = null; break;
          case 'select':   s.selectValues = []; break;
          case 'group':    s.groupValues = []; break;
          case 'having':   s.havingClauses = []; break;
          case 'distinct': s.distinctValue = false; break;
          case 'lock':     s.lockValue = null; break;
          case 'none':     s.noneValue = false; break;
        }
      }
    });
  }

  /** Reverse every order clause (asc <-> desc). */
  reverseOrder(): Relation<T> {
    return this.chain((s) => {
      s.orderValues = s.orderValues.map((o) => reverseOrdering(o));
    });
  }

  /** Replace every where clause that targets one of the given attributes. */
  rewhere(input: WhereInput<T>): Relation<T> {
    if (typeof input !== 'object' || Array.isArray(input) || input instanceof ArelNodes.Node) {
      return this.chain((s) => {
        s.whereClauses = [];
        s.whereClauses.push(buildPredicate(this.klass, input, false));
      });
    }
    const attributes = new Set(Object.keys(input as Record<string, unknown>));
    return this.chain((s) => {
      s.whereClauses = s.whereClauses.filter((clause) => !mentionsAnyAttribute(clause, attributes));
      s.whereClauses.push(buildPredicate(this.klass, input, false));
    });
  }

  // ──────────────────────────── building the SelectManager ────────────────────────────

  /** Resolve an attribute reference on this relation's table. */
  private attr(name: string): Attribute {
    return this.table.attribute(name);
  }

  /** Build a `SelectManager` from the current state. */
  buildArel(): SelectManager {
    const manager = this.table.from();
    if (this.state.selectValues.length > 0) {
      manager.project(...this.state.selectValues);
    } else {
      manager.project(this.table.attribute(Arel.star));
    }
    // INNER / LEFT OUTER JOINs from `joins('user', 'comments')` /
    // `leftOuterJoins('user')` / `eagerLoad('user')`. Each association
    // name resolves through the registry to a reflection that knows the
    // FK/PK columns to bind.
    for (const assocName of this.state.joinAssociations) {
      const fragment = this.joinFragmentFor(assocName, 'inner');
      if (fragment) manager.join(Arel.sql(fragment));
    }
    for (const assocName of this.state.leftJoinAssociations) {
      const fragment = this.joinFragmentFor(assocName, 'left');
      if (fragment) manager.join(Arel.sql(fragment));
    }
    for (const clause of this.state.whereClauses) manager.where(clause);
    for (const clause of this.state.havingClauses) manager.having(clause);
    if (this.state.groupValues.length > 0) manager.group(...this.state.groupValues);
    if (this.state.orderValues.length > 0) manager.order(...this.state.orderValues);
    if (this.state.limitValue != null) manager.take(this.state.limitValue);
    if (this.state.offsetValue != null) manager.skip(this.state.offsetValue);
    if (this.state.distinctValue) manager.distinct(true);
    if (this.state.lockValue) manager.lock(this.state.lockValue === true ? true : this.state.lockValue);
    if (this.state.annotations.length > 0) {
      // Render annotations as a single `/* ... */` comment block — Rails'
      // SelectStatement appends comments after the lock clause.
      manager.comment(this.state.annotations.join(' '));
    }
    return manager;
  }

  /** Resolve an association name into a `[INNER|LEFT OUTER] JOIN ... ON ...` fragment. */
  private joinFragmentFor(name: string, kind: 'inner' | 'left'): string | null {
    const reflection = lookupAssociation(this.klass, name);
    if (!reflection) throw new Error(`Unknown association "${name}" on ${this.klass.name}`);
    const op = kind === 'left' ? 'LEFT OUTER JOIN' : 'INNER JOIN';
    if (reflection.kind === 'belongs_to') {
      const target = (reflection.classRef!() as unknown) as { effectiveTableName(): string };
      const targetTable = target.effectiveTableName();
      const own = ((this.klass as unknown) as { effectiveTableName(): string }).effectiveTableName();
      return `${op} "${targetTable}" ON "${targetTable}"."${reflection.primaryKey}" = "${own}"."${reflection.foreignKey}"`;
    }
    // has_many / has_one — FK on the owned side
    const target = (reflection.classRef!() as unknown) as { effectiveTableName(): string };
    const targetTable = target.effectiveTableName();
    const own = ((this.klass as unknown) as { effectiveTableName(): string }).effectiveTableName();
    return `${op} "${targetTable}" ON "${targetTable}"."${reflection.foreignKey}" = "${own}"."${reflection.primaryKey}"`;
  }

  /** Render to `[sql, binds]` against the model's adapter. */
  toSql(): [string, unknown[]] {
    return this.klass.connection().toSql(this.buildArel());
  }

  /** Materialize the relation, hydrating model instances and running preloads. */
  async toArray(): Promise<T[]> {
    if (this.loaded) return this.loaded;
    if (this.state.noneValue) {
      this.loaded = [];
      return this.loaded;
    }
    const [sql, binds] = this.toSql();
    const rows = await this.klass.connection().execute(sql, binds);
    this.loaded = rows.map((row) => this.klass.instantiate(row));
    if (this.state.preloadValues.length > 0 && this.loaded.length > 0) {
      for (const name of this.state.preloadValues) {
        await preloadAssociation(this.loaded, name);
      }
    }
    return this.loaded;
  }

  /** Force a re-execution next time. */
  reload(): this {
    this.loaded = null;
    return this;
  }

  // ──────────────────────────── terminal queries ────────────────────────────

  async first(n?: number): Promise<T | T[] | null> {
    const limited = this.limit(n ?? 1).order(...this.defaultOrderFallback());
    const rows = await limited.toArray();
    if (n === undefined) return rows[0] ?? null;
    return rows;
  }

  async last(n?: number): Promise<T | T[] | null> {
    const orders = this.reverseOrders();
    const limited = new Relation<T>(this.klass, { ...cloneState(this.state), orderValues: orders }).limit(n ?? 1);
    const rows = await limited.toArray();
    if (n === undefined) return rows[0] ?? null;
    return rows.reverse();
  }

  async take(n?: number): Promise<T | T[] | null> {
    if (n === undefined) {
      const rows = await this.limit(1).toArray();
      return rows[0] ?? null;
    }
    return this.limit(n).toArray();
  }

  async find(ids: readonly unknown[]): Promise<T[]>;
  async find(id: unknown): Promise<T>;
  async find(...ids: unknown[]): Promise<T[]>;
  async find(idOrIds: unknown, ...rest: unknown[]): Promise<T | T[]> {
    const pk = this.klass.primaryKey;
    // Normalize argument forms: find(1) | find([1, 2]) | find(1, 2, 3)
    const ids = Array.isArray(idOrIds) ? (idOrIds as unknown[]) : [idOrIds, ...rest];
    if (ids.length === 0) throw new RecordNotFound(`Couldn't find ${this.klass.name} without an ID`);
    if (ids.length === 1 && !Array.isArray(idOrIds)) {
      const row = await this.where({ [pk]: ids[0] } as WhereInput<T>).take();
      if (!row) throw new RecordNotFound(`Couldn't find ${this.klass.name} with ${pk}=${String(ids[0])}`);
      return row as T;
    }
    const records = await this.where({ [pk]: ids } as WhereInput<T>).toArray();
    if (records.length !== ids.length) {
      throw new RecordNotFound(
        `Couldn't find all ${this.klass.name} with ${pk}: (${ids.join(', ')}) (found ${records.length} results, but was looking for ${ids.length})`,
      );
    }
    // Preserve the order of the input ids.
    const byId = new Map(records.map((r) => [String(r.readAttribute(pk)), r]));
    return ids.map((id) => byId.get(String(id))).filter((r): r is T => r !== undefined);
  }

  async findBy(input: WhereInput<T>): Promise<T | null> {
    const row = await this.where(input).take();
    return (row as T) ?? null;
  }

  async exists(input?: WhereInput<T>): Promise<boolean> {
    let scope: Relation<T> = this;
    if (input !== undefined) scope = this.where(input);
    const rows = await scope.limit(1).toArray();
    return rows.length > 0;
  }

  async count(column?: string): Promise<number | Map<unknown, number>> {
    return (await this.aggregate('COUNT', column ?? '*')) as number | Map<unknown, number>;
  }

  async sum(column: string): Promise<number | Map<unknown, number>> {
    return (await this.aggregate('SUM', column)) as number | Map<unknown, number>;
  }

  async minimum(column: string): Promise<number | null | Map<unknown, number | null>> {
    return this.aggregate('MIN', column, { allowNull: true });
  }

  async maximum(column: string): Promise<number | null | Map<unknown, number | null>> {
    return this.aggregate('MAX', column, { allowNull: true });
  }

  async average(column: string): Promise<number | null | Map<unknown, number | null>> {
    return this.aggregate('AVG', column, { allowNull: true });
  }

  /**
   * Issue a single-projection aggregate. When the relation has a `group`
   * clause, returns a `Map<groupKey, aggregate>` keyed by the group value;
   * otherwise returns a scalar number.
   */
  private async aggregate(fn: string, column: string, options?: { allowNull: boolean }): Promise<number | null | Map<unknown, number | null>> {
    const manager = this.buildArel();
    const groupCols = this.state.groupValues;
    const aggregateSql = `${fn}(${column})`;
    if (groupCols.length === 0) {
      manager.setProjections([Arel.sql(aggregateSql)]);
      const [sql, binds] = this.klass.connection().toSql(manager);
      const rows = await this.klass.connection().execute(sql, binds);
      return coerceAggregate(rows[0] ? Object.values(rows[0])[0] : undefined, options?.allowNull);
    }
    // Build projections: `group_col AS group_0`, `aggregate AS value`.
    const projections: Expression[] = [];
    const groupAliases: string[] = [];
    groupCols.forEach((g, i) => {
      const alias = `group_${i}`;
      groupAliases.push(alias);
      projections.push(Arel.sql(`${groupExpressionToSql(g)} AS ${alias}`));
    });
    projections.push(Arel.sql(`${aggregateSql} AS value`));
    manager.setProjections(projections);
    const [sql, binds] = this.klass.connection().toSql(manager);
    const rows = await this.klass.connection().execute(sql, binds);
    const map = new Map<unknown, number | null>();
    for (const row of rows) {
      const key = groupAliases.length === 1
        ? row[groupAliases[0]!]
        : groupAliases.map((a) => row[a]);
      map.set(key, coerceAggregate(row['value'], options?.allowNull));
    }
    return map;
  }

  async pluck<R = unknown>(...columns: string[]): Promise<R[]> {
    const manager = this.buildArel();
    manager.setProjections(columns.map((c) => Arel.sql(c)));
    const [sql, binds] = this.klass.connection().toSql(manager);
    const rows = await this.klass.connection().execute(sql, binds);
    if (columns.length === 1) {
      const c = columns[0]!;
      return rows.map((r) => r[c] as R);
    }
    return rows.map((r) => columns.map((c) => r[c]) as unknown as R);
  }

  async ids(): Promise<unknown[]> {
    return this.pluck(this.klass.primaryKey);
  }

  // ──────────────────────────── PromiseLike — await relation directly ────────────────────────────

  then<U = T[], V = never>(
    onfulfilled?: ((value: T[]) => U | PromiseLike<U>) | undefined | null,
    onrejected?: ((reason: unknown) => V | PromiseLike<V>) | undefined | null,
  ): PromiseLike<U | V> {
    return this.toArray().then(onfulfilled, onrejected);
  }

  // ──────────────────────────── helpers ────────────────────────────

  /** When no order is set, fall back to ordering by primary key for first/last stability. */
  private defaultOrderFallback(): Expression[] {
    if (this.state.orderValues.length > 0) return [];
    return [this.attr(this.klass.primaryKey).asc()];
  }

  /** Compute the reversed order expressions for `last`. */
  private reverseOrders(): Expression[] {
    if (this.state.orderValues.length === 0) return [this.attr(this.klass.primaryKey).desc()];
    return this.state.orderValues.map((o) => {
      if (typeof o === 'object' && o !== null && 'reverse' in o && typeof (o as { reverse: () => Expression }).reverse === 'function') {
        return (o as { reverse: () => Expression }).reverse();
      }
      return o;
    });
  }
}

export class RecordNotFound extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** Coerce a DB-returned aggregate scalar into a JS number (or null when allowed). */
const coerceAggregate = (value: unknown, allowNull = false): number | null => {
  if (value === null || value === undefined) return allowNull ? null : 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const n = Number(value);
    if (!Number.isNaN(n)) return n;
  }
  return allowNull ? null : 0;
};

/** Render a group expression to a SQL fragment for projection aliasing. */
const groupExpressionToSql = (expr: Expression): string => {
  if (expr instanceof Arel.Nodes.SqlLiteral) return expr.toString();
  if (typeof expr === 'object' && expr !== null && 'relation' in expr && 'name' in expr) {
    // Attribute-like: `"table"."column"`
    const attr = expr as { relation: { name: string | { toString(): string } }; name: string };
    const rel = typeof attr.relation.name === 'string' ? attr.relation.name : attr.relation.name.toString();
    return `"${rel}"."${attr.name}"`;
  }
  // Fall back to the visitor-rendered form.
  return String(expr);
};

const collapseAnd = (clauses: Expression[]): Expression | null => {
  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0]!;
  return new ArelNodes.And(clauses) as unknown as Expression;
};

const reverseOrdering = (expr: Expression): Expression => {
  if (expr && typeof expr === 'object' && 'reverse' in expr && typeof (expr as { reverse: () => Expression }).reverse === 'function') {
    return (expr as { reverse: () => Expression }).reverse();
  }
  // String / SQL literal order — append a `DESC` flip heuristically (best-effort).
  return expr;
};

/** Check whether a where-clause references any of the attributes named in `attrs`. */
const mentionsAnyAttribute = (node: unknown, attrs: Set<string>): boolean => {
  if (node == null) return false;
  if (typeof node !== 'object') return false;
  const n = node as { name?: unknown; left?: unknown; right?: unknown; children?: unknown[] };
  if (typeof n.name === 'string' && attrs.has(n.name)) return true;
  if (n.left && mentionsAnyAttribute(n.left, attrs)) return true;
  if (n.right && mentionsAnyAttribute(n.right, attrs)) return true;
  if (Array.isArray(n.children)) {
    for (const c of n.children) if (mentionsAnyAttribute(c, attrs)) return true;
  }
  return false;
};


const buildOrders = <T extends Base>(klass: BaseConstructor<T>, order: OrderInput): Expression[] => {
  if (typeof order === 'string') return [Arel.sql(order)];
  if (typeof order === 'object' && order !== null && !isExpressionLike(order)) {
    const expressions: Expression[] = [];
    for (const [name, dir] of Object.entries(order)) {
      const attr = klass.arelTable().attribute(name);
      const lower = (dir as string).toLowerCase();
      expressions.push(lower === 'desc' ? attr.desc() : attr.asc());
    }
    return expressions;
  }
  return [order as Expression];
};

const isExpressionLike = (value: object): boolean => {
  if (typeof (value as { toSql?: unknown }).toSql === 'function') return true;
  if ('relation' in value && 'name' in value) return true; // Attribute
  if (value instanceof ArelNodes.Node) return true;
  return false;
};
