import { FetchAttributeBinaryNode, NotInNode } from './Binary';

export class InNode extends FetchAttributeBinaryNode {
  override equality = () => true;
  override invert = () => new NotInNode(this.left, this.right);
}
