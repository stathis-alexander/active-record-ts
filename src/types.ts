import type { Attribute } from './Attribute';
import type { Node } from './Nodes/Node';
import type { CteNode, Node as NodeT, SelectStatementNode, SqlLiteralNode, TableAliasNode } from './Nodes/types';
import type { SelectManager } from './SelectManager';
import type { Table } from './Table';

export type { Attribute } from './Attribute';
export type * from './Collectors/types';
export type * from './Nodes/types';
export type { Table } from './Table';
export type * from './Visitors/types';

/**
 * Raw JavaScript values that the visitor can quote into SQL literals (NULL,
 * 'foo', 't', 1, '2026-01-01', etc.). Used by `buildQuoted` and the
 * `quoteValue` helper.
 */
export type Quotable = string | number | boolean | bigint | Date | null | undefined;

/**
 * Brand applied to any class whose instances are valid Arel operands. The brand
 * is declared by the expression-bearing mixin chain (Math, Expressions,
 * Predications, OrderPredications, AliasPredication) so that mixin code can use
 * a plain `this` reference where an `Expression` is required, without an
 * awkward `this as unknown as Expression` cast.
 *
 * The optional `__arelOperand?: never` field is purely phantom — it only
 * exists in the type system, never at runtime. The `never` payload ensures
 * the brand can't be forged by arbitrary object literals.
 */
export interface ArelOperand {
  readonly __arelOperand?: never;
}

/**
 * Anything that can appear on the left or right of an Arel operator. Includes
 * Arel nodes (Node tree + the String-derived SqlLiteralNode), the `Attribute`
 * wrapper, raw quotable values, `SelectManager` (for subqueries), and any
 * mixin-decorated class that carries the `ArelOperand` brand.
 */
export type Expression = ArelOperand | NodeT | SqlLiteralNode | Attribute | SelectManager | Quotable;

/**
 * Anything that can be used as a relation source — a real table, an aliased
 * table, a CTE, a SQL literal (free-form table reference), or a subquery
 * (`SelectManager`).
 */
export type RelationLike = Table | TableAliasNode | CteNode | SqlLiteralNode | SelectManager;

/** Items projected by SELECT — attributes, expressions, sub-managers, strings (sugar). */
export type Projection = Expression | string;

/** Items usable in WHERE / HAVING — boolean-producing nodes, sql literals, strings (sugar). */
export type Condition = Node | string;

/** Items usable in ORDER BY — orderings, attributes, sql literals, strings (sugar). */
export type OrderingExpression = Expression | string;

/** Items usable in GROUP BY. */
export type GroupExpression = Expression | string;

/** Where a CTE / WITH expression may live. */
export type WithExpression = TableAliasNode | CteNode | AsLike;

/** AS-aliased pair (manager.as("foo"), attribute.as("bar"), etc.). */
export type AsLike = { left: unknown; right: unknown };

/** Subquery sources accepted by `.in()` / `.notIn()`. */
export type SubquerySource = SelectManager | SelectStatementNode;

/**
 * Values acceptable as bind-param positional values. May be a primitive
 * (`Quotable`), an Arel node (wrapped `SqlLiteral`/`BoundSqlLiteral`/etc.),
 * or a nested array (used to expand `IN (?)` placeholders).
 */
export type BindValue = Quotable | NodeT | SqlLiteralNode | BindValue[];

/** Map of named bind values, e.g. `{ id: 1 }` for `:id`. */
export type NamedBinds = Record<string, BindValue>;

/** Options accepted by `Arel.sql(...)`. */
export type SqlOptions = {
  retryable?: boolean;
  positionalBinds?: BindValue[];
  namedBinds?: NamedBinds;
};

/** Options accepted by `attribute.between(...)`, `attribute.notBetween(...)`. */
export type BetweenOptions = { excludeEnd?: boolean };

/** Options accepted by `Cte` to emit a MATERIALIZED / NOT MATERIALIZED modifier. */
export type CteOptions = { materialized?: boolean };

/** A factory of nodes (instantiable class). */
// biome-ignore lint/suspicious/noExplicitAny: standard "any constructor" pattern; subclass constructor signatures vary
export type NodeCtor<T extends Node = Node> = new (...args: any[]) => T;

/** Re-export of the FetchAttribute callback shape from `Nodes/Node`. */
export type { FetchAttributeCallback } from './Nodes/Node';
