import { Nodes } from './Nodes';
import { TreeManagerWithStatementMethods } from './TreeManager';

type TableType = any;

export class DeleteManager extends TreeManagerWithStatementMethods {
  constructor(table?: TableType) {
    super();
    this.ast = new Nodes.DeleteStatement(table);
  }

  from = (relation: TableType) => {
    this.ast.relation = relation;
    return this;
  };
  group = (columns: string[]) => {
    columns.forEach((column) => {
      this.ast.groups.push(new Nodes.Group(new Nodes.SqlLiteral(column)));
    });
    return this;
  };
  having = (expression: any) => {
    this.ast.havings.push(expression);
    return this;
  };
  comment = (value: any) => {
    this.ast.comment = value;
    return this;
  };
}
