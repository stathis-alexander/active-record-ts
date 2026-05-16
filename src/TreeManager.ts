import { Collectors } from './Collectors';
import { FactoryMethods } from './FactoryMethods';
import { Nodes } from './Nodes';
import type { LimitNode, OffsetNode } from './Nodes/Unary';
import type { Expression } from './types';
import { buildQuoted } from './utilities/nodes';
import { Visitors } from './Visitors';

export class TreeManager extends FactoryMethods {
  /**
   * The AST root. Concrete managers (`SelectManager`, `InsertManager`, etc.)
   * `declare` this with a specific node type.
   */
  public ast: unknown = null;

  toSql = (): string => {
    const collector = new Collectors.SqlString();
    return new Visitors.ToSql().accept(this.ast, collector).value();
  };
}

export class TreeManagerWithStatementMethods extends TreeManager {
  public declare ast: {
    limit: LimitNode | null;
    offset: OffsetNode | null;
    orders: Expression[];
    key: Expression | null;
    wheres: Expression[];
  };

  take = (limit: Expression | null | undefined) => {
    if (limit != null) this.ast.limit = new Nodes.Limit(buildQuoted(limit));
    return this;
  };
  offset = (offset: Expression | null | undefined) => {
    if (offset != null) this.ast.offset = new Nodes.Offset(buildQuoted(offset));
    return this;
  };
  order = (...expressions: Expression[]) => {
    this.ast.orders = expressions;
    return this;
  };
  set key(key: Expression) {
    this.ast.key = key;
  }
  get key(): Expression | null {
    return this.ast.key;
  }
  wheres = (expressions: Expression[]) => {
    this.ast.wheres = expressions;
  };
  where = (expression: Expression) => {
    this.ast.wheres.push(expression);
    return this;
  };
}
