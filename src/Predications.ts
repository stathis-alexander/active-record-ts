import { Nodes } from './Nodes';
import { SelectManager } from './SelectManager';
import type { ArelOperand, BetweenOptions, Expression, MatchesNodeOptions, SubquerySource } from './types';
import type { Constructor } from './utilities/mixins';
import { buildQuoted, buildQuotedArray, isInfinity } from './utilities/nodes';

type Predicate = (other: Expression, options?: unknown) => Expression;

/** Map of predicate method names to their signatures — the methods that `*Any`/`*All` can fan out across. */
type PredicateMethods = {
  equal: (other: Expression) => Expression;
  greaterThan: (other: Expression) => Expression;
  greaterThanOrEqual: (other: Expression) => Expression;
  in: (other: Expression | Expression[]) => Expression;
  lessThan: (other: Expression) => Expression;
  lessThanOrEqual: (other: Expression) => Expression;
  // biome-ignore lint/suspicious/noShadowRestrictedNames: matches Arel impl.
  matches: (other: Expression, escape?: string | null, caseSensitive?: boolean) => Expression;
  notEqual: (other: Expression) => Expression;
  notIn: (other: Expression | Expression[]) => Expression;
  // biome-ignore lint/suspicious/noShadowRestrictedNames: matches Arel impl.
  doesNotMatch: (other: Expression, escape?: string | null, caseSensitive?: boolean) => Expression;
};

function groupingAnyNodeFactory<K extends keyof PredicateMethods>(obj: Pick<PredicateMethods, K>, methodName: K) {
  const func = (obj[methodName] as Predicate).bind(obj);

  return (others: Expression[], options?: unknown) => {
    const nodes = others.map((other) => func(other, options));
    return new Nodes.Grouping(nodes.reduce((memo: Expression, node: Expression) => new Nodes.Or([memo, node])));
  };
}

function groupingAllNodeFactory<K extends keyof PredicateMethods>(obj: Pick<PredicateMethods, K>, methodName: K) {
  const func = (obj[methodName] as Predicate).bind(obj);

  return (others: Expression[], options?: unknown) => {
    const nodes = others.map((other) => func(other, options));
    return new Nodes.Grouping(new Nodes.And(nodes));
  };
}

const unboundable = (_value: Expression | null | undefined) => 0;

const isOpenEnded = (value: Expression | null | undefined): boolean => {
  if (value == null) return true;
  if (typeof value === 'number' || value instanceof Nodes.Quoted) return isInfinity(value) !== 0;

  return unboundable(value) !== 0;
};

export const Predications = <TBase extends Constructor>(Base: TBase) =>
  class Predications extends Base implements ArelOperand {
    declare readonly __arelOperand?: never;

    between(
      begin: Expression | null | undefined,
      end: Expression | null | undefined,
      options?: BetweenOptions,
    ): Expression {
      if (unboundable(begin) === 1 || unboundable(end) === -1) return this.in([]);
      if (isOpenEnded(begin)) {
        if (isOpenEnded(end)) {
          if (isInfinity(begin) === 1 || isInfinity(end) === -1) return this.in([]);
          return this.notIn([]);
        } else if (options?.excludeEnd) {
          return this.lessThan(end as Expression);
        } else {
          return this.lessThanOrEqual(end as Expression);
        }
      }

      if (isOpenEnded(end)) return this.greaterThanOrEqual(begin as Expression);
      if (options?.excludeEnd) {
        return this.greaterThanOrEqual(begin as Expression).and(this.lessThan(end as Expression));
      }
      if (begin === end) return this.equal(begin as Expression);

      const left = buildQuoted(begin, this);
      const right = buildQuoted(end, this);
      return new Nodes.Between(this, new Nodes.And([left, right]));
    }
    contains = (other: Expression | Expression[]) => new Nodes.Contains(this, buildQuoted(other as Expression, this));
    concat = (other: Expression) => new Nodes.Concatenation(this, buildQuoted(other, this));
    // biome-ignore lint/suspicious/noShadowRestrictedNames: matching Arel impl.
    doesNotMatch = (other: Expression, escape: string | null = null, caseSensitive?: boolean) =>
      new Nodes.DoesNotMatch(this, buildQuoted(other, this), {
        escape: escape ?? undefined,
        caseSensitive,
      });
    doesNotMatchRegex = (other: Expression, caseSensitive?: boolean) =>
      new Nodes.NotRegexp(this, buildQuoted(other, this), {
        caseSensitive: caseSensitive ?? true,
      });
    doesNotMatchRegexp = (other: Expression, caseSensitive?: boolean) =>
      new Nodes.NotRegexp(this, buildQuoted(other, this), {
        caseSensitive: caseSensitive ?? true,
      });
    doesNotMatchAny = (others: Expression[], options?: MatchesNodeOptions) =>
      groupingAnyNodeFactory(this, 'doesNotMatch')(others, options);
    doesNotMatchAll = (others: Expression[], options?: MatchesNodeOptions) =>
      groupingAllNodeFactory(this, 'doesNotMatch')(others, options);
    equal = (other: Expression) => new Nodes.Equality(this, buildQuoted(other, this));
    equalAny = (others: Expression[]) => groupingAnyNodeFactory(this, 'equal')(others);
    equalAll = (others: Expression[]) => groupingAllNodeFactory(this, 'equal')(others);
    greaterThan = (other: Expression) => new Nodes.GreaterThan(this, buildQuoted(other, this));
    greaterThanAny = (others: Expression[]) => groupingAnyNodeFactory(this, 'greaterThan')(others);
    greaterThanAll = (others: Expression[]) => groupingAllNodeFactory(this, 'greaterThan')(others);
    greaterThanOrEqual = (other: Expression) => new Nodes.GreaterThanOrEqual(this, buildQuoted(other, this));
    greaterThanOrEqualAny = (others: Expression[]) => groupingAnyNodeFactory(this, 'greaterThanOrEqual')(others);
    greaterThanOrEqualAll = (others: Expression[]) => groupingAllNodeFactory(this, 'greaterThanOrEqual')(others);
    in(others: Expression | Expression[] | SubquerySource): Expression {
      if (Array.isArray(others)) return new Nodes.In(this, buildQuotedArray(others, this));
      if (others instanceof SelectManager) return new Nodes.In(this, others.ast);

      return new Nodes.In(this, buildQuoted(others, this));
    }
    inAny = (others: Array<Expression | Expression[]>) => groupingAnyNodeFactory(this, 'in')(others as Expression[]);
    inAll = (others: Array<Expression | Expression[]>) => groupingAllNodeFactory(this, 'in')(others as Expression[]);
    isDistinctFrom = (other: Expression) => new Nodes.IsDistinctFrom(this, buildQuoted(other, this));
    isNotDistinctFrom = (other: Expression) => new Nodes.IsNotDistinctFrom(this, buildQuoted(other, this));
    lessThan = (other: Expression) => new Nodes.LessThan(this, buildQuoted(other, this));
    lessThanAny = (others: Expression[]) => groupingAnyNodeFactory(this, 'lessThan')(others);
    lessThanAll = (others: Expression[]) => groupingAllNodeFactory(this, 'lessThan')(others);
    lessThanOrEqual = (other: Expression) => new Nodes.LessThanOrEqual(this, buildQuoted(other, this));
    lessThanOrEqualAny = (others: Expression[]) => groupingAnyNodeFactory(this, 'lessThanOrEqual')(others);
    lessThanOrEqualAll = (others: Expression[]) => groupingAllNodeFactory(this, 'lessThanOrEqual')(others);
    // biome-ignore lint/suspicious/noShadowRestrictedNames: matching Arel impl with escape
    matches = (other: Expression, escape: string | null = null, caseSensitive?: boolean) =>
      new Nodes.Matches(this, buildQuoted(other, this), {
        escape: escape ?? undefined,
        caseSensitive,
      });
    matchesRegex = (other: Expression, caseSensitive?: boolean) =>
      new Nodes.Regexp(this, buildQuoted(other, this), {
        caseSensitive: caseSensitive ?? true,
      });
    matchesRegexp = (other: Expression, caseSensitive?: boolean) =>
      new Nodes.Regexp(this, buildQuoted(other, this), {
        caseSensitive: caseSensitive ?? true,
      });
    matchesAny = (others: Expression[], options?: MatchesNodeOptions) =>
      groupingAnyNodeFactory(this, 'matches')(others, options);
    matchesAll = (others: Expression[], options?: MatchesNodeOptions) =>
      groupingAllNodeFactory(this, 'matches')(others, options);
    notBetween(
      begin: Expression | null | undefined,
      end: Expression | null | undefined,
      options?: BetweenOptions,
    ): Expression {
      if (unboundable(begin) === 1 || unboundable(end) === -1) return this.notIn([]);
      if (isOpenEnded(begin)) {
        if (isOpenEnded(end)) {
          if (isInfinity(begin) === 1 || isInfinity(end) === -1) return this.notIn([]);
          return this.in([]);
        } else if (options?.excludeEnd) {
          return this.greaterThanOrEqual(end as Expression);
        } else {
          return this.greaterThan(end as Expression);
        }
      }
      if (isOpenEnded(end)) return this.lessThan(begin as Expression);

      const left = this.lessThan(begin as Expression);
      if (options?.excludeEnd) return left.or(this.greaterThanOrEqual(end as Expression));

      return left.or(this.greaterThan(end as Expression));
    }
    notEqual = (other: Expression) => new Nodes.Inequality(this, buildQuoted(other, this));
    notEqualAny = (others: Expression[]) => groupingAnyNodeFactory(this, 'notEqual')(others);
    notEqualAll = (others: Expression[]) => groupingAllNodeFactory(this, 'notEqual')(others);
    notIn(others: Expression | Expression[] | SubquerySource): Expression {
      if (Array.isArray(others)) return new Nodes.NotIn(this, buildQuotedArray(others, this));
      if (others instanceof SelectManager) return new Nodes.NotIn(this, others.ast);

      return new Nodes.NotIn(this, buildQuoted(others, this));
    }
    notInAll = (others: Array<Expression | Expression[]>) =>
      groupingAllNodeFactory(this, 'notIn')(others as Expression[]);
    notInAny = (others: Array<Expression | Expression[]>) =>
      groupingAnyNodeFactory(this, 'notIn')(others as Expression[]);
    overlaps = (other: Expression | Expression[]) => new Nodes.Overlaps(this, buildQuoted(other as Expression, this));
    when = (other: Expression) => new Nodes.Case(this).when(buildQuoted(other));
  };
