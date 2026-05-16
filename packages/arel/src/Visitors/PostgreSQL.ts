import type { Collector } from '../Collectors/types';
import { Nodes } from '../Nodes';
import type { ContainsNode, OverlapsNode } from '../Nodes/InfixOperation';
import type { InnerJoinNode } from '../Nodes/InnerJoin';
import type {
  BindParamNode,
  CubeNode,
  DistinctOnNode,
  Expression,
  GroupingElementNode,
  GroupingSetNode,
  IsDistinctFromNode,
  IsNotDistinctFromNode,
  LimitNode,
  MatchesNode,
  NotRegexpNode,
  RegexpNode,
  RollUpNode,
  SelectCoreNode,
  SelectStatementNode,
  UpdateStatementNode,
} from '../types';
import { quoteValue, ToSql } from './ToSql';

export class PostgreSQL extends ToSql {
  private bindIndex: number = 0;

  /** Reset the placeholder counter so a single visitor instance can compile multiple statements. */
  resetBindIndex(): void {
    this.bindIndex = 0;
  }

  protected override visitBindParam(node: BindParamNode, collector: Collector) {
    this.bindIndex++;
    const idx = this.bindIndex;
    collector.addBind(node, () => `$${idx}`);
    return collector;
  }

  protected override visitSelectStatement(node: SelectStatementNode, collector: Collector) {
    if (node.with) {
      collector = this.visit(node.with, collector);
      collector.collect(' ');
    }
    collector = node.cores.reduce((c, core) => this.visitSelectCore(core, c), collector);

    if (node.orders.length > 0) {
      collector.collect(' ORDER BY ');
      node.orders.forEach((order, index) => {
        if (index > 0) collector.collect(', ');
        collector = this.visit(order, collector);
      });
    }
    return this.visitSelectOptions(node, collector);
  }

  protected override visitDistinctOn(node: DistinctOnNode, collector: Collector) {
    collector.collect('DISTINCT ON ( ');
    collector = this.visit(node.expression, collector);
    collector.collect(' )');
    return collector;
  }

  protected override visitSelectCore(node: SelectCoreNode, collector: Collector) {
    collector.collect('SELECT');

    if (node.setQuantifier) {
      const setQ = node.setQuantifier;
      if (setQ.constructor.name === 'DistinctOnNode') {
        collector.collect(' ');
        collector = this.visit(setQ, collector);
      } else {
        collector = this.maybeVisit(setQ, collector);
      }
    }

    collector = this.maybeVisit(node.optimizerHints, collector);

    this.collectNodesFor(node.projections, collector, ' ');

    if (node.source && !node.source.empty()) {
      collector.collect(' FROM ');
      collector = this.visit(node.source, collector);
    }

    this.collectNodesFor(node.wheres, collector, ' WHERE ', ' AND ');
    this.collectNodesFor(node.groups, collector, ' GROUP BY ');
    this.collectNodesFor(node.havings, collector, ' HAVING ', ' AND ');
    this.collectNodesFor(node.windows, collector, ' WINDOW ');

    return this.maybeVisit(node.comment, collector);
  }

  protected override visitInnerJoin(node: InnerJoinNode, collector: Collector) {
    if (node.right) return super.visitInnerJoin(node, collector);
    collector.collect('CROSS JOIN ');
    return this.visit(node.left, collector);
  }

  protected override visitUpdateStatement(node: UpdateStatementNode, collector: Collector) {
    collector.retryable = false;
    collector.preparable = false;
    const prepared = this.prepareUpdateStatement(node);
    collector.collect('UPDATE ');

    // UPDATE with JOIN renders as:
    //   UPDATE t1 SET ... FROM t2 JOIN ... WHERE ...
    if (this.hasJoinSources(prepared)) {
      const relation = prepared.relation as { left: unknown; right: unknown[] };
      collector = this.visit(relation.left, collector);
      if (prepared.values.length > 0) {
        collector.collect(' SET ');
        this.injectJoin(prepared.values as Expression[], collector, ', ');
      }
      collector.collect(' FROM ');
      this.injectJoin(relation.right as Expression[], collector, ' ');
    } else {
      collector = this.visit(prepared.relation, collector);
      if (prepared.values.length > 0) {
        collector.collect(' SET ');
        this.injectJoin(prepared.values, collector, ', ');
      }
    }

    if (prepared.wheres.length > 0) {
      collector.collect(' WHERE ');
      this.injectJoin(prepared.wheres, collector, ' AND ');
    }

    if (prepared.orders && prepared.orders.length > 0) {
      collector.collect(' ORDER BY ');
      this.injectJoin(prepared.orders, collector, ', ');
    }

    collector = this.maybeVisit(prepared.limit, collector);
    collector = this.maybeVisit(prepared.comment, collector);
    return this.collectReturning(prepared.returning, collector);
  }

  protected override visitMatches(node: MatchesNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    if (node.caseSensitive) {
      collector.collect(' LIKE ');
    } else {
      collector.collect(' ILIKE ');
    }
    collector = this.visit(node.right, collector);
    if (node.escape) {
      collector.collect(' ESCAPE ');
      collector = this.visit(node.escape, collector);
    }
    return collector;
  }

  protected override visitDoesNotMatch(node: MatchesNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    if (node.caseSensitive) {
      collector.collect(' NOT LIKE ');
    } else {
      collector.collect(' NOT ILIKE ');
    }
    collector = this.visit(node.right, collector);
    if (node.escape) {
      collector.collect(' ESCAPE ');
      collector = this.visit(node.escape, collector);
    }
    return collector;
  }

  protected override visitRegexp(node: RegexpNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(node.caseSensitive ? ' ~ ' : ' ~* ');
    return this.visit(node.right, collector);
  }

  protected override visitNotRegexp(node: NotRegexpNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(node.caseSensitive ? ' !~ ' : ' !~* ');
    return this.visit(node.right, collector);
  }

  protected override visitIsNotDistinctFrom(node: IsNotDistinctFromNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' IS NOT DISTINCT FROM ');
    if (node.right == null) {
      collector.collect('NULL');
    } else {
      collector = this.visit(node.right, collector);
    }
    return collector;
  }

  protected override visitIsDistinctFrom(node: IsDistinctFromNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' IS DISTINCT FROM ');
    if (node.right == null) {
      collector.collect('NULL');
    } else {
      collector = this.visit(node.right, collector);
    }
    return collector;
  }

  protected visitContains(node: ContainsNode, collector: Collector) {
    return this.infixWithQuotedRhs(node, collector, ' @> ');
  }

  protected visitOverlaps(node: OverlapsNode, collector: Collector) {
    return this.infixWithQuotedRhs(node, collector, ' && ');
  }

  private infixWithQuotedRhs(node: { left: unknown; right: unknown }, collector: Collector, op: string) {
    collector = this.visit(node.left, collector);
    collector.collect(op);
    if (node.right instanceof Nodes.SqlLiteral) {
      collector.collect(quoteValue(node.right.toString()));
    } else {
      collector = this.visit(node.right, collector);
    }
    return collector;
  }

  protected override visitLimit(node: LimitNode, collector: Collector) {
    collector.collect('LIMIT ');
    if (node.expression instanceof Nodes.SqlLiteral) {
      const s = node.expression.toString();
      if (/^-?\d+$/.test(s)) {
        collector.collect(s);
      } else {
        collector.collect(quoteValue(s));
      }
    } else {
      this.visit(node.expression, collector);
    }
    return collector;
  }

  protected visitCube(node: CubeNode, collector: Collector) {
    return this.groupingDimensions('CUBE', node, collector);
  }

  protected visitRollUp(node: RollUpNode, collector: Collector) {
    return this.groupingDimensions('ROLLUP', node, collector);
  }

  protected visitGroupingSet(node: GroupingSetNode, collector: Collector) {
    return this.groupingDimensions('GROUPING SETS', node, collector);
  }

  protected visitGroupingElement(node: GroupingElementNode, collector: Collector) {
    const exprs = Array.isArray(node.expression) ? (node.expression as Expression[]) : [node.expression];
    this.injectJoin(exprs, collector, ', ');
    return collector;
  }

  /** `CUBE`, `ROLLUP`, and `GROUPING SETS` share this dimension-list emitter. */
  private groupingDimensions(name: string, node: CubeNode | RollUpNode | GroupingSetNode, collector: Collector) {
    collector.collect(`${name}( `);
    const expr = node.expression as Expression | Expression[];
    const isGroupingElement = (e: unknown): boolean =>
      !!e &&
      typeof e === 'object' &&
      (e as { constructor?: { name?: string } }).constructor?.name === 'GroupingElementNode';

    if (Array.isArray(expr)) {
      const allGroupingElements = expr.every(isGroupingElement);
      if (allGroupingElements) {
        expr.forEach((dim, i) => {
          if (i > 0) collector.collect(', ');
          collector.collect('( ');
          this.visit(dim, collector);
          collector.collect(' )');
        });
      } else {
        this.injectJoin(expr, collector, ', ');
      }
    } else {
      this.visit(expr, collector);
    }
    collector.collect(' )');
    return collector;
  }
}
