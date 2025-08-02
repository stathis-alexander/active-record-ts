import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';

export type ExpressionType = any;

export class UnaryNode extends NodeExpression {
  public expression: ExpressionType;

  constructor(expression: ExpressionType) {
    super();
    this.expression = expression;
  }

  get value() {
    return this.expression;
  }

  override hash() {
    return hash([this.constructor.name, this.expression]);
  }
}

export class BinNode extends UnaryNode {}
export class CubeNode extends UnaryNode {}
export class DistinctOnNode extends UnaryNode {}
export class GroupNode extends UnaryNode {}
export class GroupingElementNode extends UnaryNode {}
export class GroupingSetNode extends UnaryNode {}
export class LateralNode extends UnaryNode {}
export class LimitNode extends UnaryNode {}
export class LockNode extends UnaryNode {}
export class NotNode extends UnaryNode {}
export class OffsetNode extends UnaryNode {}
export class OnNode extends UnaryNode {}
export class OptimizerHintsNode extends UnaryNode {}
export class RollUpNode extends UnaryNode {}
