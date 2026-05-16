import type { Collector } from '../Collectors/types';
import { Nodes } from '../Nodes';
import type {
  BinNode,
  ConcatenationNode,
  CteNode,
  IsDistinctFromNode,
  IsNotDistinctFromNode,
  LimitNode,
  NotRegexpNode,
  NullsFirstNode,
  NullsLastNode,
  RegexpNode,
  SelectCoreNode,
  SelectStatementNode,
  UpdateStatementNode,
} from '../types';
import { quoteValue, ToSql } from './ToSql';

const MYSQL_MAX_UNSIGNED_BIGINT = '18446744073709551615';

export class MySQL extends ToSql {
  protected override visitSelectStatement(node: SelectStatementNode, collector: Collector) {
    if (node.offset && !node.limit) {
      node.limit = new Nodes.Limit(new Nodes.SqlLiteral(MYSQL_MAX_UNSIGNED_BIGINT));
    }
    return super.visitSelectStatement(node, collector);
  }

  protected override visitSelectCore(node: SelectCoreNode, collector: Collector) {
    collector.collect('SELECT');

    collector = this.maybeVisit(node.optimizerHints, collector);
    collector = this.maybeVisit(node.setQuantifier, collector);

    this.collectNodesFor(node.projections, collector, ' ');

    if (node.source && !node.source.empty()) {
      collector.collect(' FROM ');
      collector = this.visit(node.source, collector);
    } else {
      collector.collect(' FROM DUAL');
    }

    this.collectNodesFor(node.wheres, collector, ' WHERE ', ' AND ');
    this.collectNodesFor(node.groups, collector, ' GROUP BY ');
    this.collectNodesFor(node.havings, collector, ' HAVING ', ' AND ');
    this.collectNodesFor(node.windows, collector, ' WINDOW ');

    return this.maybeVisit(node.comment, collector);
  }

  protected override visitUpdateStatement(node: UpdateStatementNode, collector: Collector) {
    collector.retryable = false;
    collector.preparable = false;
    collector.collect('UPDATE ');
    collector = this.visit(node.relation, collector);

    if (node.values.length > 0) {
      collector.collect(' SET ');
      this.injectJoin(node.values, collector, ', ');
    }

    if (node.wheres.length > 0) {
      collector.collect(' WHERE ');
      this.injectJoin(node.wheres, collector, ' AND ');
    }

    if (node.orders && node.orders.length > 0) {
      collector.collect(' ORDER BY ');
      this.injectJoin(node.orders, collector, ', ');
    }

    collector = this.maybeVisit(node.limit, collector);
    return this.collectReturning(node.returning, collector);
  }

  protected override visitIsNotDistinctFrom(node: IsNotDistinctFromNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' <=> ');
    if (node.right == null) {
      collector.collect('NULL');
    } else {
      collector = this.visit(node.right, collector);
    }
    return collector;
  }

  protected override visitIsDistinctFrom(node: IsDistinctFromNode, collector: Collector) {
    collector.collect('NOT ');
    collector = this.visit(node.left, collector);
    collector.collect(' <=> ');
    if (node.right == null) {
      collector.collect('NULL');
    } else {
      collector = this.visit(node.right, collector);
    }
    return collector;
  }

  protected override visitRegexp(node: RegexpNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' REGEXP ');
    return this.visit(node.right, collector);
  }

  protected override visitNotRegexp(node: NotRegexpNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' NOT REGEXP ');
    return this.visit(node.right, collector);
  }

  protected override visitBin(node: BinNode, collector: Collector) {
    collector.collect('CAST(');
    collector = this.visit(node.expression, collector);
    collector.collect(' AS BINARY)');
    return collector;
  }

  protected visitConcatenation(node: ConcatenationNode, collector: Collector) {
    collector.collect('CONCAT(');
    collector = this.visit(node.left, collector);
    collector.collect(', ');
    if (node.right instanceof Nodes.SqlLiteral) {
      collector.collect(quoteValue(node.right.toString()));
    } else {
      collector = this.visit(node.right, collector);
    }
    collector.collect(')');
    return collector;
  }

  protected override visitNullsFirst(node: NullsFirstNode, collector: Collector) {
    const inner = node.expression;
    // expression is Ascending/Descending
    collector = this.visit(inner.expression, collector);
    collector.collect(' IS NOT NULL, ');
    return this.visit(inner, collector);
  }

  protected override visitNullsLast(node: NullsLastNode, collector: Collector) {
    const inner = node.expression;
    collector = this.visit(inner.expression, collector);
    collector.collect(' IS NULL, ');
    return this.visit(inner, collector);
  }

  protected override visitLimit(node: LimitNode, collector: Collector) {
    collector.collect('LIMIT ');
    if (node.expression instanceof Nodes.SqlLiteral) {
      const s = node.expression.toString();
      // Auto-quote string literals in LIMIT (mimics adapter-level quoting)
      if (/^\d+$/.test(s)) {
        collector.collect(s);
      } else {
        collector.collect(quoteValue(s));
      }
    } else {
      this.visit(node.expression, collector);
    }
    return collector;
  }

  protected override visitCte(node: CteNode, collector: Collector) {
    // MySQL: ignore materialized modifier
    const cteWithoutMaterialized = { ...node, materialized: undefined } as CteNode;
    Object.setPrototypeOf(cteWithoutMaterialized, Object.getPrototypeOf(node));
    return super.visitCte(cteWithoutMaterialized, collector);
  }
}
