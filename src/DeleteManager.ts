import { Nodes } from './Nodes';
import type { CommentNode } from './Nodes/Comment';
import type { JoinSourceNode } from './Nodes/JoinSource';
import { TreeManagerWithStatementMethods } from './TreeManager';
import type { DeleteStatementNode, Expression, RelationLike } from './types';

export class DeleteManager extends TreeManagerWithStatementMethods {
  public declare ast: DeleteStatementNode;

  constructor(table?: RelationLike | JoinSourceNode | null) {
    super();
    this.ast = new Nodes.DeleteStatement((table as RelationLike) ?? null);
  }

  from = (relation: RelationLike) => {
    this.ast.relation = relation;
    return this;
  };
  group = (columns: string[]) => {
    columns.forEach((column) => {
      this.ast.groups.push(new Nodes.Group(new Nodes.SqlLiteral(column)));
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
