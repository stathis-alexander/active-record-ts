import { Collectors } from './Collectors';
import { DeleteManager } from './DeleteManager';
import { EmptyJoinError } from './errors';
import { Nodes } from './Nodes';
import type { JoinNode } from './Nodes/Binary';
import type { JoinSourceNode } from './Nodes/JoinSource';
import type { SelectCoreNode } from './Nodes/SelectCore';
import type { SqlLiteralNode } from './Nodes/SqlLiteral';
import type { TableAliasNode } from './Nodes/TableAlias';
import type { LateralNode } from './Nodes/Unary';
import type { NamedWindowNode } from './Nodes/Window';
import { Table } from './Table';
import { TreeManager } from './TreeManager';
import type { Expression, JoinType, RelationLike, SelectStatementNode } from './types';
import { UpdateManager } from './UpdateManager';
import { lastOrThrow } from './utilities/array';
import { collapse, Join } from './utilities/nodes';
import { ToSql } from './Visitors/ToSql';

/**
 * If the expression is a node that wraps a primitive value (like a `Quoted`
 * or `Casted`), return the underlying value. Otherwise return the expression
 * itself. Used by `.offset()` / `.taken()` so callers see e.g. `10` not
 * `Quoted(10)`.
 */
const unwrapValue = (expr: Expression | undefined): Expression => {
  if (expr && typeof expr === 'object' && 'value' in expr) {
    return (expr as { value: Expression }).value;
  }
  return expr as Expression;
};

export class SelectManager extends TreeManager {
  public declare ast: SelectStatementNode;

  constructor(table?: RelationLike) {
    super();
    this.ast = new Nodes.SelectStatement(table);
  }

  ctx = (): SelectCoreNode => lastOrThrow(this.ast.cores);
  limit = (): Expression => this.ast.limit?.expression as Expression;
  constraints = (): Expression[] => this.ctx().wheres;
  offset = (): Expression => unwrapValue(this.ast.offset?.expression);
  taken = (): Expression => unwrapValue(this.ast.limit?.expression);
  skip = (amount?: number | null) => {
    if (amount != null) {
      this.ast.offset = new Nodes.Offset(amount);
    } else {
      this.ast.offset = null;
    }
    return this;
  };
  exists = () => new Nodes.Exists(this.ast);
  as = (alias: string | SqlLiteralNode): TableAliasNode => {
    const right = typeof alias === 'string' ? new Nodes.SqlLiteral(alias, { retryable: true }) : alias;
    return new Nodes.TableAlias(new Nodes.Grouping(this.ast), right);
  };
  lock = (locking: true | string | SqlLiteralNode = new Nodes.SqlLiteral('FOR UPDATE')) => {
    let lockValue: SqlLiteralNode;
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
  locked = (): boolean => this.ast.lock != null;
  on = (...expressions: Array<Expression | string>) => {
    const joinSource = this.ctx().source;
    const lastJoinOperation = lastOrThrow(joinSource.right);
    const mappedExpressions = expressions.map((e) => (typeof e === 'string' ? new Nodes.SqlLiteral(e) : e));
    lastJoinOperation.right = new Nodes.On(collapse(mappedExpressions));
    return this;
  };
  group = (...columns: Array<Expression | string>) => {
    columns.forEach((column) => {
      const literalNode = typeof column === 'string' ? new Nodes.SqlLiteral(column) : column;
      this.ctx().groups.push(new Nodes.Group(literalNode));
    });
    return this;
  };
  from = (table: Table | TableAliasNode | SqlLiteralNode | string | JoinNode) => {
    const joinSource = this.ctx().source;
    if (typeof table === 'string') {
      joinSource.left = new Nodes.SqlLiteral(table, { retryable: true });
    } else if (table instanceof Table || table instanceof Nodes.SqlLiteral || table instanceof Nodes.TableAlias) {
      joinSource.left = table;
    } else {
      // Already narrowed to JoinNode via the union exclusion above.
      joinSource.right.push(table);
    }

    return this;
  };
  froms = (): RelationLike[] =>
    this.ast.cores.map((core) => core.from).filter((from): from is RelationLike => Boolean(from));
  get joinSources(): JoinNode[] {
    return this.ctx().source.right;
  }
  join = (relation?: RelationLike | string | null, joinType: JoinType = 'inner') => {
    if (relation == null) return this;
    if (typeof relation === 'string' && relation === '') {
      throw new EmptyJoinError('Cannot join on empty string');
    }
    const joinSource = this.ctx().source;
    let actualRelation: RelationLike;
    let actualJoinType: JoinType;
    if (typeof relation === 'string') {
      actualJoinType = 'string';
      actualRelation = new Nodes.SqlLiteral(relation);
    } else if (relation instanceof Nodes.SqlLiteral) {
      actualJoinType = 'string';
      actualRelation = relation;
    } else {
      actualJoinType = joinType;
      actualRelation = relation;
    }
    const joinNodeClass = Join(actualJoinType);
    joinSource.right.push(new joinNodeClass(actualRelation, null));
    return this;
  };
  outerJoin = (relation: RelationLike | string) => this.join(relation, 'outer');
  having = (expression: Expression | string) => {
    const expr = typeof expression === 'string' ? new Nodes.SqlLiteral(expression) : expression;
    this.ctx().havings.push(expr);
    return this;
  };
  window = (name: string): NamedWindowNode => {
    const window = new Nodes.NamedWindow(name);
    this.ctx().windows.push(window);
    return window;
  };
  project = (...projections: Array<Expression | string>) => {
    projections.forEach((projection) => {
      const proj = typeof projection === 'string' ? new Nodes.SqlLiteral(projection) : projection;
      this.ctx().projections.push(proj);
    });
    return this;
  };
  projections = (): Expression[] => this.ctx().projections;
  setProjections = (projections: Expression[]) => {
    this.ctx().projections = projections;
    return this;
  };
  optimizerHints = (...optimizerHints: Expression[]): SelectManager => {
    if (optimizerHints.length === 0) return this;

    this.ctx().optimizerHints = new Nodes.OptimizerHints(optimizerHints);
    return this;
  };
  distinct = (value: boolean = true) => {
    if (value) {
      this.ctx().setQuantifier = new Nodes.Distinct();
    } else {
      this.ctx().setQuantifier = null;
    }

    return this;
  };
  distinctOn = (value?: Expression | null) => {
    if (value) {
      this.ctx().setQuantifier = new Nodes.DistinctOn(value);
    } else {
      this.ctx().setQuantifier = null;
    }
    return this;
  };
  order = (...orders: Array<Expression | string>) => {
    orders.forEach((order) => {
      const o = typeof order === 'string' ? new Nodes.SqlLiteral(order) : order;
      this.ast.orders.push(o);
    });
    return this;
  };
  orders = (): Expression[] => this.ast.orders;
  where = (expression: Expression | string | TreeManager) => {
    let expr: Expression;
    if (typeof expression === 'string') {
      expr = new Nodes.SqlLiteral(expression);
    } else if (expression instanceof TreeManager) {
      expr = expression.ast as Expression; // TreeManager.ast is unknown — narrows to Expression for the where clause
    } else {
      expr = expression;
    }

    this.ctx().wheres.push(expr);
    return this;
  };
  union = (other: SelectManager) => new Nodes.Union(this.ast, other.ast);
  unionAll = (other: SelectManager) => new Nodes.UnionAll(this.ast, other.ast);
  intersect = (other: SelectManager) => new Nodes.Intersect(this.ast, other.ast);
  except = (other: SelectManager) => new Nodes.Except(this.ast, other.ast);
  take = (limit?: number | null) => {
    if (limit != null) {
      this.ast.limit = new Nodes.Limit(limit);
    } else {
      this.ast.limit = null;
    }
    return this;
  };
  with = (...subqueries: Array<'recursive' | Expression>) => {
    const isRecursive = subqueries[0] === 'recursive';
    const queries: Expression[] = isRecursive ? (subqueries.slice(1) as Expression[]) : (subqueries as Expression[]);

    const NodeClass = isRecursive ? Nodes.WithRecursive : Nodes.With;
    this.ast.with = new NodeClass(queries);
    return this;
  };

  lateral = (tableName?: string): LateralNode | TableAliasNode => {
    const lateralNode = new Nodes.Lateral(new Nodes.Grouping(this.ast));
    if (tableName) {
      return new Nodes.TableAlias(lateralNode, new Nodes.SqlLiteral(tableName));
    }
    return lateralNode;
  };

  get source(): JoinSourceNode {
    return this.ctx().source;
  }

  comment = (value: string) => {
    this.ctx().comment = new Nodes.Comment([value]);
    return this;
  };

  /**
   * Render the WHERE clause as a `SqlLiteral`, joining multiple wheres with
   * AND. Returns `null` when there are no wheres. Mirrors Rails' `where_sql`.
   */
  whereSql = (visitor: ToSql = new ToSql()): SqlLiteralNode | null => {
    const wheres = this.ctx().wheres;
    if (wheres.length === 0) return null;
    const collector = new Collectors.SqlString();
    const andNode = new Nodes.And(wheres);
    const sql = visitor.accept(andNode, collector).value();
    return new Nodes.SqlLiteral(`WHERE ${sql}`);
  };

  /**
   * Build an `UpdateManager` from this SELECT — copies WHERE / ORDER /
   * LIMIT / OFFSET / GROUP / HAVING / comment. Mirrors Rails' `compile_update`.
   */
  compileUpdate = (values: Parameters<UpdateManager['set']>[0], key?: Expression) => {
    const um = new UpdateManager(this.source);
    um.set(values);
    um.take(this.limit());
    um.offset(this.offset());
    um.order(...this.orders());
    um.wheres(this.constraints());
    um.comment(this.ctx().comment);
    if (key != null) um.key = key;
    um.ast.groups = this.ctx().groups;
    this.ctx().havings.forEach((h) => um.having(h));
    return um;
  };

  /**
   * Build a `DeleteManager` from this SELECT — copies WHERE / ORDER /
   * LIMIT / OFFSET / GROUP / HAVING / comment. Mirrors Rails' `compile_delete`.
   */
  compileDelete = (key?: Expression) => {
    const dm = new DeleteManager(this.source);
    dm.take(this.limit());
    dm.offset(this.offset());
    dm.order(...this.orders());
    dm.wheres(this.constraints());
    dm.comment(this.ctx().comment);
    if (key != null) dm.key = key;
    dm.ast.groups = this.ctx().groups;
    this.ctx().havings.forEach((h) => dm.having(h));
    return dm;
  };
}
