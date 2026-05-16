import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import { isArelNode } from '../utilities/isArelNode';
import { Node } from './Node';

export class FragmentsNode extends Node {
  public values: Expression[];

  constructor(values: Expression[] = []) {
    super();
    this.values = values;
  }

  override hash = () => hash(this.values);

  add = (other: Expression) => {
    if (!isArelNode(other)) throw new Error('Expected a node');

    return new FragmentsNode([...this.values, other]);
  };
}
