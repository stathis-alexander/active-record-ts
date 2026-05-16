import type { Attribute } from './Attribute';
import { Nodes } from './Nodes';
import type { SqlLiteralNode } from './Nodes/SqlLiteral';
import type { ValuesListNode } from './Nodes/ValuesList';
import type { SelectManager } from './SelectManager';
import { TreeManager } from './TreeManager';
import type { Expression, InsertStatementNode, RelationLike } from './types';
import { buildQuoted } from './utilities/nodes';

/** A single `[column, value]` pair accepted by `InsertManager.insert`. */
export type InsertPair = [Attribute | Expression, Expression];

export class InsertManager extends TreeManager {
  public declare ast: InsertStatementNode;

  constructor(table?: RelationLike) {
    super();
    this.ast = new Nodes.InsertStatement(table);
  }
  into = (t: RelationLike) => {
    this.ast.relation = t;
    return this;
  };
  columns = (): Expression[] => this.ast.columns;
  values = (val: ValuesListNode | SqlLiteralNode) => {
    this.ast.values = val;
    return this;
  };
  select = (select: SelectManager) => {
    this.ast.select = select;
    return this;
  };
  insert = (fields: InsertPair[] | string) => {
    if (typeof fields === 'string') {
      this.ast.values = new Nodes.SqlLiteral(fields);
      return this;
    }
    if (fields == null || fields.length === 0) return this;

    if (this.ast.relation == null && fields[0]?.[0] && (fields[0][0] as Attribute).relation) {
      this.ast.relation = (fields[0][0] as Attribute).relation as RelationLike;
    }

    const values: Expression[] = [];

    fields.forEach((pair) => {
      const [column, value] = pair;
      this.ast.columns.push(column as Expression);
      values.push(this.castValue(column as Attribute, value));
    });
    this.ast.values = this.createValues(values);

    return this;
  };
  private castValue(column: Attribute, value: Expression): Expression {
    if (value instanceof Nodes.Node || value instanceof Nodes.SqlLiteral) return value;
    if (column?.relation?.ableToTypeCast?.()) {
      return new Nodes.Casted(value, column);
    }
    return buildQuoted(value, column);
  }
  createValues = (values: Expression[]) => new Nodes.ValuesList([values]);
  createValuesList = (rows: Expression[][]) => new Nodes.ValuesList(rows);
  returning = (values: Expression | Expression[]) => {
    if (Array.isArray(values)) {
      this.ast.returning.push(...values);
    } else {
      this.ast.returning.push(values);
    }
    return this;
  };
}
