import { type ExpressionType, UnaryNode } from './Unary';

export class ValuesListNode extends UnaryNode {
  public rows: ExpressionType;

  constructor(rows: ExpressionType) {
    super(rows);
    this.rows = rows;
  }
}
