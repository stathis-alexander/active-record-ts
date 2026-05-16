import type { Expression } from '../types';
import { UnaryNode } from './Unary';

export class ValuesListNode extends UnaryNode {
  public rows: Expression[][];

  constructor(rows: Expression[][]) {
    super(rows);
    this.rows = rows;
  }
}
