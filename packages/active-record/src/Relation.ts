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
import type { Base, BaseConstructor } from './Base';
import { buildPredicate, type WhereInput } from './predicates';
import type { Row } from './types';

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
    for (const clause of this.state.whereClauses) manager.where(clause);
    for (const clause of this.state.havingClauses) manager.having(clause);
    if (this.state.groupValues.length > 0) manager.group(...this.state.groupValues);
    if (this.state.orderValues.length > 0) manager.order(...this.state.orderValues);
    if (this.state.limitValue != null) manager.take(this.state.limitValue);
    if (this.state.offsetValue != null) manager.skip(this.state.offsetValue);
    if (this.state.distinctValue) manager.distinct(true);
    if (this.state.lockValue) manager.lock(this.state.lockValue === true ? true : this.state.lockValue);
    return manager;
  }

  /** Render to `[sql, binds]` against the model's adapter. */
  toSql(): [string, unknown[]] {
    return this.klass.connection().toSql(this.buildArel());
  }

  /** Materialize the relation, hydrating model instances. */
  async toArray(): Promise<T[]> {
    if (this.loaded) return this.loaded;
    if (this.state.noneValue) {
      this.loaded = [];
      return this.loaded;
    }
    const [sql, binds] = this.toSql();
    const rows = await this.klass.connection().execute(sql, binds);
    this.loaded = rows.map((row) => this.klass.instantiate(row));
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

  async find(id: unknown): Promise<T> {
    const pk = this.klass.primaryKey;
    const row = await this.where({ [pk]: id } as WhereInput<T>).take();
    if (!row) throw new RecordNotFound(`Couldn't find ${this.klass.name} with ${pk}=${String(id)}`);
    return row as T;
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

  async count(column?: string): Promise<number> {
    const manager = this.buildArel();
    manager.setProjections([column ? Arel.sql(`COUNT(${column})`) : Arel.sql('COUNT(*)')]);
    const [sql, binds] = this.klass.connection().toSql(manager);
    const rows = await this.klass.connection().execute(sql, binds);
    return numericFromCount(rows[0]);
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

const numericFromCount = (row: Row | undefined): number => {
  if (!row) return 0;
  for (const v of Object.values(row)) {
    if (typeof v === 'number') return v;
    if (typeof v === 'bigint') return Number(v);
    if (typeof v === 'string') {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
  }
  return 0;
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
