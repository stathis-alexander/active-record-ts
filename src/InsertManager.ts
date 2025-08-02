import { Nodes } from './Nodes';
import { TreeManager } from './TreeManager';

type TableType = any;

export class InsertManager extends TreeManager {
  constructor(table?: TableType) {
    super();
    this.ast = new Nodes.InsertStatement(table);
  }
  into = (t: TableType) => {
    this.ast.relation = t;
    return this;
  };
  columns = () => this.ast.columns;
  values = (val: any) => {
    this.ast.values = val;
  };
  select = (select: any) => {
    this.ast.select = select;
  };
  insert = (fields: any) => {
    if (fields.length === 0) return undefined;

    if (typeof fields === 'string') {
      this.ast.values = new Nodes.SqlLiteral(fields);
    } else {
      if (this.ast.relation == null) {
        this.ast.relation = fields[0][0].relation;
      }

      const values = [] as any[];

      fields.forEach((column: any, value: any) => {
        this.ast.columns.push(column);
        values.push(value);
      });
      this.ast.values = this.createValues(values);
    }

    return this;
  };
  createValues = (values: any) => new Nodes.ValuesList([values]);
  createValuesList = (rows: any) => new Nodes.ValuesList(rows);
}
