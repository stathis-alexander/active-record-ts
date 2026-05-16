import { type ExpressionType, UnaryNode } from './Unary';

/** Shape exposed by Attribute / TableAlias — what `UnqualifiedColumn` reads. */
type ColumnLike = { relation: unknown; column?: unknown; name: unknown };

export class UnqualifiedColumnNode extends UnaryNode {
  get attribute() {
    return this.expression;
  }
  set attribute(attribute: ExpressionType) {
    this.expression = attribute;
  }

  relation = () => (this.expression as ColumnLike).relation;
  column = () => (this.expression as ColumnLike).column;
  name = () => (this.expression as ColumnLike).name;
}
