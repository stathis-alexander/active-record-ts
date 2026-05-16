import type { Collector } from '../Collectors/types';
import { Nodes } from '../Nodes';
import type { IsDistinctFromNode, IsNotDistinctFromNode, LockNode, SelectStatementNode } from '../types';
import { ToSql } from './ToSql';

export class SQLite extends ToSql {
  protected override visitSelectStatement(node: SelectStatementNode, collector: Collector) {
    if (node.offset && !node.limit) {
      node.limit = new Nodes.Limit(new Nodes.SqlLiteral('-1'));
    }
    return super.visitSelectStatement(node, collector);
  }

  protected override visitLock(_node: LockNode, _collector: Collector) {
    // SQLite doesn't support locking - return collector unchanged
    return _collector;
  }

  protected override visitIsNotDistinctFrom(node: IsNotDistinctFromNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' IS ');
    if (node.right == null) {
      collector.collect('NULL');
    } else {
      collector = this.visit(node.right, collector);
    }
    return collector;
  }

  protected override visitIsDistinctFrom(node: IsDistinctFromNode, collector: Collector) {
    collector = this.visit(node.left, collector);
    collector.collect(' IS NOT ');
    if (node.right == null) {
      collector.collect('NULL');
    } else {
      collector = this.visit(node.right, collector);
    }
    return collector;
  }
}
