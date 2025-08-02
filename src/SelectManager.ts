import { Nodes } from './Nodes';
import type { JoinType } from './Nodes/types';
import { Table } from './Table';
import { TreeManager } from './TreeManager';
import { lastOrThrow } from './utilities/array';
import { collapse, Join } from './utilities/nodes';

type TableType = any;

export class SelectManager extends TreeManager {
  constructor(table?: TableType) {
    super();
    this.ast = new Nodes.SelectStatement(table);
  }

  ctx = () => lastOrThrow(this.ast.cores);
  limit = () => this.ast.limit?.expression;
  constraints = () => this.ctx().wheres;
  offset = () => this.ast.offset?.expression;
  skip = (amount?: number) => {
    if (amount) {
      this.ast.offset = new Nodes.Offset(amount);
    } else {
      this.ast.offset = null;
    }
    return this;
  };
  exists = () => new Nodes.Exists(this.ast);
  as = (alias: string) =>
    new Nodes.TableAlias(new Nodes.Grouping(this.ast), new Nodes.SqlLiteral(alias, { retryable: true }));
  lock = (locking: true | any | string = new Nodes.SqlLiteral('FOR UPDATE')) => {
    // sqlLiteralNode
    let lockValue: any;
    if (locking === true) {
      lockValue = new Nodes.SqlLiteral('FOR UPDATE');
    } else if (typeof locking === 'string') {
      lockValue = new Nodes.SqlLiteral(locking);
    } else {
      lockValue = locking;
    }

    this.ast.lock = new Nodes.Lock(lockValue);
    return this;
  };
  locked = () => this.ast.lock != null;
  on = (...expressions: any[]) => {
    const joinSource = this.ctx().source;
    const lastJoinOperation = lastOrThrow(joinSource.right);
    lastJoinOperation.right = new Nodes.On(collapse(expressions));
    return this;
  };
  group = (...columns: string[]) => {
    columns.forEach((column) => {
      let literalNode: any;
      if (typeof column === 'string') {
        literalNode = new Nodes.SqlLiteral(column);
      } else {
        literalNode = column;
      }

      this.ctx().groups.push(new Nodes.Group(literalNode));
    });
    return this;
  };
  from = (table: any) => {
    const joinSource = this.ctx().source;
    if (typeof table === 'string') {
      joinSource.left = new Nodes.SqlLiteral(table, { retryable: true });
    } else if (table instanceof Table) {
      joinSource.left = table;
    } else {
      joinSource.right.push(table);
    }

    return this;
  };
  froms = () => this.ast.cores.map((core) => core.from).filter((from) => Boolean(from));
  join = (relation?: any, joinType: JoinType = 'inner') => {
    if (!relation) return this;
    const joinSource = this.ctx().source;
    if (typeof relation === 'string') {
      joinType = 'string';
      relation = new Nodes.SqlLiteral(relation);
    } else if (relation instanceof Nodes.SqlLiteral) {
      joinType = 'string';
    }
    const joinNodeClass = Join(joinType);
    joinSource.right.push(new joinNodeClass(relation, [], joinType));
    return this;
  };
  outerJoin = (relation: any) => this.join(relation, 'outer');
  having = (expression: any) => {
    if (typeof expression === 'string') {
      expression = new Nodes.SqlLiteral(expression);
    }

    this.ctx().havings.push(expression);
    return this;
  };
  window = (name: string) => {
    const window = new Nodes.Window(name);
    this.ctx().windows.push(window);
    return window;
  };
  project = (...projections: any[]) => {
    projections.forEach((projection) => {
      if (typeof projection === 'string') {
        projection = new Nodes.SqlLiteral(projection);
      }
      this.ctx().projections.push(projection);
    });
    return this;
  };
  projections = () => this.ctx().projections;
  setProjections = (projections: any[]) => {
    this.ctx().projections = projections;
    return this;
  };
  optimizerHints = (...optimizerHints: any[]) => {
    if (optimizerHints.length === 0) return this;

    this.ctx().optimizerHints = new Nodes.OptimizerHints(optimizerHints);
    return this;
  };
  distinct = (value = true) => {
    if (value) {
      this.ctx().setQuantifier = new Nodes.Distinct();
    } else {
      this.ctx().setQuantifier = null;
    }

    return this;
  };
  distinctOn = (value?: any | null) => {
    if (value) {
      this.ctx().setQuantifier = new Nodes.DistinctOn(value);
    } else {
      this.ctx().setQuantifier = null;
    }
    return this;
  };
  order = (...orders: any[]) => {
    orders.forEach((order) => {
      if (typeof order === 'string') {
        order = new Nodes.SqlLiteral(order);
      }
      this.ast.orders.push(order);
    });
    return this;
  };
  orders = () => this.ast.orders;
  where = (expression: any) => {
    if (typeof expression === 'string') {
      expression = new Nodes.SqlLiteral(expression);
    } else if (expression instanceof TreeManager) {
      expression = expression.ast;
    }

    this.ctx().wheres.push(expression);
    return this;
  };
  union = (other: any) => new Nodes.Union(this.ast, other.ast);
  unionAll = (other: any) => new Nodes.UnionAll(this.ast, other.ast);
  take = (limit?: number | null) => {
    if (limit) {
      this.ast.limit = new Nodes.Limit(limit);
    } else {
      this.ast.limit = null;
    }
    return this;
  };
}
