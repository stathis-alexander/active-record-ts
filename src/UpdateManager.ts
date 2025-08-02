import { Nodes } from './Nodes';
import { TreeManagerWithStatementMethods } from './TreeManager';

type TableType = any;
type ValuesType = any;
type GroupType = string[];
type HavingType = any;
type CommentType = any;

export class UpdateManager extends TreeManagerWithStatementMethods {
  constructor(table?: TableType) {
    super();
    this.ast = new Nodes.UpdateStatement(table);
  }

  table = (t: TableType) => {
    this.ast.relation = t;
    return this;
  };
  set = (values: ValuesType) => {
    if (typeof values === 'string' || values instanceof Nodes.BoundSqlLiteral) {
      this.ast.values = [values];
    } else {
      this.ast.values = Object.entries(values).map(
        ([column, value]) => new Nodes.Assignment(new Nodes.UnqualifiedColumn(column), value),
      );
    }
    return this;
  };
  group = (columns: GroupType) => {
    columns.forEach((column) => {
      this.ast.groups.push(new Nodes.Group(new Nodes.SqlLiteral(column)));
    });
    return this;
  };
  having = (expression: HavingType) => {
    this.ast.havings.push(expression);
    return this;
  };
  comment = (value: CommentType) => {
    this.ast.comment = value;
    return this;
  };
}
