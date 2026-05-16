import type { FetchAttributeCallback, Node } from './Node';
import { UnaryNode } from './Unary';

export class GroupingNode extends UnaryNode {
  override fetchAttribute = (callback: FetchAttributeCallback) => (this.expression as Node).fetchAttribute(callback);
}
