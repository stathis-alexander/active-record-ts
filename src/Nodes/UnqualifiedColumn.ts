import { type ExpressionType, UnaryNode } from './Unary';

export class UnqualifiedColumnNode extends UnaryNode {
  get attribute() {
    return this.expression;
  }
  set attribute(attribute: ExpressionType) {
    this.expression = attribute;
  }

  relation = () => this.expression.relation;
  column = () => this.expression.column;
  name = () => this.expression.name;
}
