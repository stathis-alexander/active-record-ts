import { Nodes } from './Nodes';
import type { MatchesNodeOptions } from './Nodes/types';
import { SelectManager } from './SelectManager';
import type { Constructor } from './utilities/mixins';
import { buildQuoted, buildQuotedArray, isInfinity } from './utilities/nodes';

type GroupableKeys =
  | 'equal'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'in'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'matches'
  | 'notEqual'
  | 'notIn'
  | 'doesNotMatch';

function groupingAnyNodeFactory(obj: any, methodName: GroupableKeys) {
  const func = obj[methodName].bind(obj);

  return (others: any[], options = {}) => {
    const nodes = others.map((other) => func(other, options));
    return new Nodes.Grouping(nodes.reduce((memo, node) => new Nodes.Or([memo, node])));
  };
}

function groupingAllNodeFactory(obj: any, methodName: GroupableKeys) {
  const func = obj[methodName].bind(obj);

  return (others: any[], options = {}) => {
    const nodes = others.map((other) => func(other, options));
    return new Nodes.Grouping(new Nodes.And(nodes));
  };
}

const unboundable = (_value: any | null) => 0;

const isOpenEnded = (value: any | null) => {
  if (value == null) return true;
  if (typeof value === 'number' || value instanceof Nodes.Quoted) return isInfinity(value);

  return unboundable(value);
};

export const Predications = <TBase extends Constructor>(Base: TBase) =>
  class Predications extends Base {
    between = (begin: any | null, end: any | null, options?: { excludeEnd?: boolean }) => {
      if (unboundable(begin) === 1 || unboundable(end) === -1) return this.in([]);
      if (isOpenEnded(begin)) {
        if (isOpenEnded(end)) {
          if (isInfinity(begin) === 1 || isInfinity(end) === -1) return this.in([]);

          return this.notIn([]);
        } else if (options?.excludeEnd) {
          return this.lessThan(end);
        } else {
          return this.lessThanOrEqual(end);
        }
      }

      if (isOpenEnded(end)) return this.greaterThanOrEqual(begin);
      if (options?.excludeEnd) return this.greaterThanOrEqual(begin).and(this.lessThan(end));
      if (begin === end) return this.equal(begin);

      const left = buildQuoted(begin, this);
      const right = buildQuoted(end, this);
      return new Nodes.Between(this, new Nodes.And([left, right]));
    };
    contains = (other: any) => new Nodes.Contains(this, buildQuoted(other, this));
    doesNotMatch = (other: any, options?: MatchesNodeOptions) =>
      new Nodes.DoesNotMatch(this, buildQuoted(other, this), options);
    doesNotMatchRegex = (other: any, options?: Exclude<MatchesNodeOptions, 'escape'>) =>
      new Nodes.DoesNotMatch(this, buildQuoted(other, this), options);
    doesNotMatchAny = (others: any[], options?: Exclude<MatchesNodeOptions, 'caseSensitive'>) =>
      groupingAnyNodeFactory(this, 'doesNotMatch')(others, options);
    doesNotMatchAll = (others: any[], options?: Exclude<MatchesNodeOptions, 'caseSensitive'>) =>
      groupingAllNodeFactory(this, 'doesNotMatch')(others, options);
    equal = (other: any) => new Nodes.Equality(this, buildQuoted(other, this));
    equalAny = (others: any[]) => groupingAnyNodeFactory(this, 'equal')(others);
    equalAll = (others: any[]) => groupingAllNodeFactory(this, 'equal')(others);
    greaterThan = (other: any) => new Nodes.GreaterThan(this, buildQuoted(other, this));
    greaterThanAny = (others: any[]) => groupingAnyNodeFactory(this, 'greaterThan')(others);
    greaterThanAll = (others: any[]) => groupingAllNodeFactory(this, 'greaterThan')(others);
    greaterThanOrEqual = (other: any) => new Nodes.GreaterThanOrEqual(this, buildQuoted(other, this));
    greaterThanOrEqualAny = (others: any[]) => groupingAnyNodeFactory(this, 'greaterThanOrEqual')(others);
    greaterThanOrEqualAll = (others: any[]) => groupingAllNodeFactory(this, 'greaterThanOrEqual')(others);
    in = (others: any | any[]) => {
      // fix this to handle narrowing to the right type
      if (Array.isArray(others)) return new Nodes.In(this, buildQuotedArray(others, this));
      if (others instanceof SelectManager) return new Nodes.In(this, others.ast);

      return new Nodes.In(this, buildQuoted(others, this));
    };
    inAny = (others: any[][]) => groupingAnyNodeFactory(this, 'in')(others);
    inAll = (others: any[][]) => groupingAllNodeFactory(this, 'in')(others);
    lessThan = (other: any) => new Nodes.LessThan(this, buildQuoted(other, this));
    lessThanAny = (others: any[]) => groupingAnyNodeFactory(this, 'lessThan')(others);
    lessThanAll = (others: any[]) => groupingAllNodeFactory(this, 'lessThan')(others);
    lessThanOrEqual = (other: any) => new Nodes.LessThanOrEqual(this, buildQuoted(other, this));
    lessThanOrEqualAny = (others: any[]) => groupingAnyNodeFactory(this, 'lessThanOrEqual')(others);
    lessThanOrEqualAll = (others: any[]) => groupingAllNodeFactory(this, 'lessThanOrEqual')(others);
    matches = (other: any, options?: MatchesNodeOptions) => new Nodes.Matches(this, buildQuoted(other, this), options);
    matchesRegex = (other: any, options?: Exclude<MatchesNodeOptions, 'escape'>) =>
      new Nodes.Matches(this, buildQuoted(other, this), options);
    matchesAny = (others: any[], options?: Exclude<MatchesNodeOptions, 'caseSensitive'>) =>
      groupingAnyNodeFactory(this, 'matches')(others, options);
    matchesAll = (others: any[], options?: Exclude<MatchesNodeOptions, 'caseSensitive'>) =>
      groupingAllNodeFactory(this, 'matches')(others, options);
    notBetween = (begin: any | null, end: any | null, options?: { excludeEnd?: boolean }) => {
      if (unboundable(begin) === 1 || unboundable(end) === -1) return this.notIn([]);
      if (isOpenEnded(begin)) {
        if (isOpenEnded(end)) {
          if (isInfinity(begin) === 1 || isInfinity(end) === -1) return this.notIn([]);

          return this.in([]);
        } else if (options?.excludeEnd) {
          return this.greaterThanOrEqual(end);
        } else {
          return this.greaterThan(end);
        }
      }
      if (isOpenEnded(end)) return this.lessThan(begin);

      const left = this.lessThan(begin);
      if (options?.excludeEnd) return left.or(this.greaterThanOrEqual(end));

      return left.or(this.greaterThan(end));
    };
    notEqual = (other: any) => new Nodes.Inequality(this, buildQuoted(other, this));
    notEqualAny = (others: any[]) => groupingAnyNodeFactory(this, 'notEqual')(others);
    notEqualAll = (others: any[]) => groupingAllNodeFactory(this, 'notEqual')(others);
    notIn = (others: any | any[]) => {
      if (Array.isArray(others)) return new Nodes.NotIn(this, buildQuotedArray(others, this));
      if (others instanceof SelectManager) return new Nodes.NotIn(this, others.ast);

      return new Nodes.NotIn(this, buildQuoted(others, this));
    };
    notInAll = (others: any[][]) => groupingAllNodeFactory(this, 'notIn')(others);
    notInAny = (others: any[][]) => groupingAnyNodeFactory(this, 'notIn')(others);
    overlaps = (other: any) => new Nodes.Overlaps(this, buildQuoted(other));
    when = (other: any) => {
      return new Nodes.Case(this).when(buildQuoted(other));
    };
  };
