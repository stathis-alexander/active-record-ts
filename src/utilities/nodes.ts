import { Attribute } from '../Attribute';
import { Nodes } from '../Nodes';
import { SelectManager } from '../SelectManager';
import { Table } from '../Table';
import type { JoinType } from '../types';
import { isArelNode } from './isArelNode';

export const collapse = (expressions: any[]) => {
  const compactified = expressions.filter((expression) => Boolean(expression));
  if (compactified.length === 1) return compactified[0];

  return new Nodes.And(compactified);
};

export const buildQuoted = (other: any, attribute?: any) => {
  if (other == null) return new Nodes.Quoted(null);

  if (isArelNode(other) || other instanceof SelectManager || other instanceof Table) return other;
  if (attribute instanceof Attribute) return new Nodes.Casted(other, attribute);

  return new Nodes.Quoted(other);
};

export const buildQuotedArray = (others: any[], attribute?: any) =>
  others.map((other) => buildQuoted(other, attribute));

export const isNull = (value: any) => {
  if (value == null) return true;
  if (value instanceof Nodes.Node) return value.isNull();

  return false;
};

// value.respond_to?(:infinite?) && value.infinite?
export const isInfinity = (value: any) => {
  if (value instanceof Nodes.Quoted) return value.isInfinity();
  if (typeof value !== 'number') return 0;
  if (Number.isFinite(value)) return 0;

  return value > 0 ? 1 : -1;
};

// value.respond_to?(:unboundable?) && value.unboundable?
export const isUnboundable = (value: any) => false;

// value.nil? || infinity?(value) || unboundable?(value)
export const isOpenEnded = (value: any) => value == null || isInfinity(value) || isUnboundable(value);

export const Join = (joinType: JoinType) => {
  switch (joinType) {
    case 'inner':
      return Nodes.InnerJoin;
    case 'outer':
      return Nodes.OuterJoin;
    case 'fullOuter':
      return Nodes.FullOuterJoin;
    case 'rightOuter':
      return Nodes.RightOuterJoin;
    case 'leading':
      return Nodes.LeadingJoin;
    case 'string':
      return Nodes.StringJoin;
    default:
      throw new Error(`Unexpected value: ${joinType}`);
  }
};
