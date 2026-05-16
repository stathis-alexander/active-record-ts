import { NodeExpression } from '../NodeExpression';
import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import type { FetchAttributeCallbackType } from './Node';

class NaryNode extends NodeExpression {
  public children: Expression[];

  constructor(children: Expression[]) {
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
    this.children.length > 0 &&
    this.children.every((child) =>
      (child as { fetchAttribute?: (cb: FetchAttributeCallbackType) => unknown }).fetchAttribute?.(callback),
    );

  override hash = () => {
    return hash([this.constructor.name, ...this.children]);
  };
}

export class AndNode extends NaryNode {}
export class OrNode extends NaryNode {}
