import { type ExpressionType, UnaryNode } from './Unary';

export class UnaryOperationNode extends UnaryNode {
  public readonly operator: string;

  constructor(operator: string, expression: ExpressionType) {
    super(expression);
    this.operator = operator;
  }
}

export class BitwiseNotNode extends UnaryOperationNode {
  constructor(expression: ExpressionType) {
    super('~', expression);
  }
}
