import { Attribute } from '../Attribute';
import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';
import { Nodes } from '.';
import type { FetchAttributeCallbackType } from './Node';

export type LeftType = any;
export type RightType = any;

export class BinaryNode extends NodeExpression {
  public left: LeftType;
  public right: RightType;

  constructor(left: LeftType, right: RightType) {
    super();
    this.left = left;
    this.right = right;
  }

  override hash() {
    return hash([this.constructor.name, this.left, this.right]);
  }
}

export class AsNode extends BinaryNode {
  toCte = () => new Nodes.Cte(this.left.name, this.right);
}
export class AssignmentNode extends BinaryNode {}
export class IntersectNode extends BinaryNode {}
export class ExceptNode extends BinaryNode {}
export class UnionNode extends BinaryNode {}
export class UnionAllNode extends BinaryNode {}

export class FetchAttributeBinaryNode extends BinaryNode {
  override fetchAttribute = (callback: FetchAttributeCallbackType) => {
    if (this.left instanceof Attribute) return callback(this.left);
    if (this.right instanceof Attribute) return callback(this.right);
  };
}

export class BetweenNode extends FetchAttributeBinaryNode {}
export class GreaterThanNode extends FetchAttributeBinaryNode {
  override invert = () => new LessThanOrEqualNode(this.left, this.right);
}
export class GreaterThanOrEqualNode extends FetchAttributeBinaryNode {
  override invert = () => new LessThanNode(this.left, this.right);
}
export class InequalityNode extends FetchAttributeBinaryNode {
  override invert = () => new Nodes.Equality(this.left, this.right);
}
export class IsDistinctFromNode extends FetchAttributeBinaryNode {
  override invert = () => new IsNotDistinctFromNode(this.left, this.right);
}
export class IsNotDistinctFromNode extends FetchAttributeBinaryNode {
  override invert = () => new IsDistinctFromNode(this.left, this.right);
}
export class LessThanNode extends FetchAttributeBinaryNode {
  override invert = () => new GreaterThanOrEqualNode(this.left, this.right);
}
export class LessThanOrEqualNode extends FetchAttributeBinaryNode {
  override invert = () => new GreaterThanNode(this.left, this.right);
}
export class NotInNode extends FetchAttributeBinaryNode {
  override invert = () => new Nodes.In(this.left, this.right);
}

export type JoinType = 'inner' | 'outer' | 'rightOuter' | 'fullOuter' | 'string' | 'leading';

export abstract class JoinNode extends BinaryNode {
  public abstract readonly joinType: JoinType;
}
