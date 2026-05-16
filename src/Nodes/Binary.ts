import { Attribute } from '../Attribute';
import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';
import { Nodes } from '.';
import type { FetchAttributeCallback } from './Node';

/**
 * `left` and `right` are typed as `unknown` here so that subclasses can
 * narrow them to specific shapes (e.g. `JoinSourceNode.right` is `JoinNode[]`,
 * `CteNode.relation` is `RelationLike`). Use casts at consumption points.
 */
export class BinaryNode extends NodeExpression {
  public left: unknown;
  public right: unknown;

  constructor(left: unknown, right?: unknown) {
    super();
    this.left = left;
    this.right = right;
  }

  override hash() {
    return hash([this.constructor.name, this.left, this.right]);
  }
}

export class AsNode extends BinaryNode {
  toCte = () => {
    const left = this.left as { name: string };
    return new Nodes.Cte(left.name, this.right as import('../types').RelationLike);
  };
}
export class AssignmentNode extends BinaryNode {}
export class IntersectNode extends BinaryNode {}
export class ExceptNode extends BinaryNode {}
export class UnionNode extends BinaryNode {}
export class UnionAllNode extends BinaryNode {}

export class FetchAttributeBinaryNode extends BinaryNode {
  override fetchAttribute = (callback: FetchAttributeCallback) => {
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
