import type { FetchAttributeCallbackType } from './Node';
import { UnaryNode } from './Unary';

export class GroupingNode extends UnaryNode {
  override fetchAttribute = (callback: FetchAttributeCallbackType) => this.expression.fetchAttribute(callback);
}
