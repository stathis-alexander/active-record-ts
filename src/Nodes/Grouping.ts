import type { FetchAttributeCallbackType, Node } from './Node';
import { UnaryNode } from './Unary';

export class GroupingNode extends UnaryNode {
  override fetchAttribute = (callback: FetchAttributeCallbackType) =>
    (this.expression as Node).fetchAttribute(callback);
}
