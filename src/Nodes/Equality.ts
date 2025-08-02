import { BinaryNode, InequalityNode } from './Binary';

export class EqualityNode extends BinaryNode {
  override equality = () => true;
  override invert = () => new InequalityNode(this.left, this.right);
}
