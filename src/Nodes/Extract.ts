import { hash } from '../utilities/hash';
import { type ExpressionType, UnaryNode } from './Unary';

export class ExtractNode extends UnaryNode {
  public field: string;

  constructor(expression: ExpressionType, field: string) {
    super(expression);
    this.field = field;
  }

  override hash() {
    return hash([this.field, super.hash()]);
  }
}
