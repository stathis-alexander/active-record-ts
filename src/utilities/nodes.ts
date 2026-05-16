import { Attribute } from '../Attribute';
import { Nodes } from '../Nodes';
import type { JoinNode } from '../Nodes/Binary';
import { SelectManager } from '../SelectManager';
import { Table } from '../Table';
import type { Expression, JoinType, NodeCtor } from '../types';
import { isArelNode } from './isArelNode';

export const collapse = (expressions: Array<Expression | null | undefined>): Expression => {
  const compactified = expressions.filter((expression): expression is Expression => Boolean(expression));
  const [first, ...rest] = compactified;
  if (first !== undefined && rest.length === 0) return first;

  return new Nodes.And(compactified);
};

/**
 * Accepts `unknown` so that plain objects (which the visitor JSON-stringifies)
 * and other adapter-provided values can flow through. Returns an Arel node
 * suitable for use as an `Expression`.
 */
export const buildQuoted = (other: unknown, attribute?: unknown): Expression => {
  if (other == null) return new Nodes.Quoted(null);

  if (isArelNode(other) || other instanceof SelectManager || other instanceof Table) return other as Expression;
  if (attribute instanceof Attribute) return new Nodes.Casted(other, attribute);

  return new Nodes.Quoted(other);
};

export const buildQuotedArray = (others: Expression[], attribute?: unknown): Expression[] =>
  others.map((other) => buildQuoted(other, attribute));

export const isNull = (value: unknown): boolean => {
  if (value == null) return true;
  if (value instanceof Nodes.Node) return value.isNull();

  return false;
};

// value.respond_to?(:infinite?) && value.infinite?
export const isInfinity = (value: unknown): number => {
  if (value instanceof Nodes.Quoted) return value.isInfinity();
  if (typeof value !== 'number') return 0;
  if (Number.isFinite(value)) return 0;

  return value > 0 ? 1 : -1;
};

// value.respond_to?(:unboundable?) && value.unboundable?
export const isUnboundable = (_value: unknown): number => 0;

// value.nil? || infinity?(value) || unboundable?(value)
export const isOpenEnded = (value: unknown): boolean =>
  value == null || isInfinity(value) !== 0 || isUnboundable(value) !== 0;

export function Join(joinType: JoinType): NodeCtor<JoinNode> {
  switch (joinType) {
    case 'inner':
      return Nodes.InnerJoin as NodeCtor<JoinNode>;
    case 'outer':
      return Nodes.OuterJoin as NodeCtor<JoinNode>;
    case 'fullOuter':
      return Nodes.FullOuterJoin as NodeCtor<JoinNode>;
    case 'rightOuter':
      return Nodes.RightOuterJoin as NodeCtor<JoinNode>;
    case 'leading':
      return Nodes.LeadingJoin as NodeCtor<JoinNode>;
    case 'string':
      return Nodes.StringJoin as NodeCtor<JoinNode>;
    default:
      throw new Error(`Unexpected value: ${joinType}`);
  }
}
