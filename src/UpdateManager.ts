import type { Attribute } from './Attribute';
import { Nodes } from './Nodes';
import type { CommentNode } from './Nodes/Comment';
import type { InnerJoinNode } from './Nodes/InnerJoin';
import type { JoinSourceNode } from './Nodes/JoinSource';
import { TreeManagerWithStatementMethods } from './TreeManager';
import type { Expression, RelationLike, UpdateStatementNode } from './types';
import { buildQuoted } from './utilities/nodes';

/** A single `[column, value]` pair accepted by `UpdateManager.set`. */
export type UpdatePair = [Attribute | Expression, Expression];

export class UpdateManager extends TreeManagerWithStatementMethods {
  public declare ast: UpdateStatementNode;

  constructor(table?: RelationLike) {
    super();
    this.ast = new Nodes.UpdateStatement(table);
  }

  /** UPDATE target — typically a `Table`, but may be a `JoinSource` or `InnerJoin` to express UPDATE...JOIN. */
  table = (t: RelationLike | JoinSourceNode | InnerJoinNode) => {
    this.ast.relation = t as RelationLike;
    return this;
  };
  set = (values: UpdatePair[] | string | Expression | Record<string, Expression>) => {
    if (values instanceof Nodes.SqlLiteral || values instanceof Nodes.BoundSqlLiteral) {
      this.ast.values = [values];
    } else if (Array.isArray(values)) {
      // list of lists: [[column, value], ...]
      this.ast.values = values.map(([column, value]) => {
        const quotedValue = this.castValue(column as Attribute, value);
        return new Nodes.Assignment(new Nodes.UnqualifiedColumn(column), quotedValue);
      });
    } else if (typeof values === 'string') {
      this.ast.values = [new Nodes.SqlLiteral(values)];
    } else {
      this.ast.values = Object.entries(values as Record<string, Expression>).map(
        ([column, value]) => new Nodes.Assignment(new Nodes.UnqualifiedColumn(column), value),
      );
    }
    return this;
  };
  private castValue(column: Attribute, value: Expression): Expression {
    if (value instanceof Nodes.Node || value instanceof Nodes.SqlLiteral) return value;
    if (column?.relation?.ableToTypeCast?.()) {
      return new Nodes.Casted(value, column);
    }
    return buildQuoted(value, column);
  }
  group = (columns: Array<Expression | string>) => {
    columns.forEach((column) => {
      this.ast.groups.push(new Nodes.Group(column));
    });
    return this;
  };
  having = (expression: Expression) => {
    this.ast.havings.push(expression);
    return this;
  };
  comment = (value: CommentNode | null) => {
    this.ast.comment = value;
    return this;
  };
  returning = (values: Expression | Expression[]) => {
    if (Array.isArray(values)) {
      this.ast.returning.push(...values);
    } else {
      this.ast.returning.push(values);
    }
    return this;
  };
}
