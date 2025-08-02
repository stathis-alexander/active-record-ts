import { NodeExpression } from '../NodeExpression';
import { hash } from '../utilities/hash';
import type { FetchAttributeCallbackType } from './Node';

type ChildrenType = any[];

class NaryNode extends NodeExpression {
  public children: ChildrenType;

  constructor(children: ChildrenType) {
    super();
    this.children = children;
  }

  get left() {
    return this.children[0];
  }
  get right() {
    return this.children[1];
  }

  override fetchAttribute = (callback: FetchAttributeCallbackType) =>
    this.children.length > 0 && this.children.every((child) => child.fetchAttribute(callback));

  override hash = () => {
    return hash([this.constructor.name, ...this.children]);
  };
}

export class AndNode extends NaryNode {}
export class OrNode extends NaryNode {}
