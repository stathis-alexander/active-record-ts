import { hash } from '../utilities/hash';
import { isArelNode } from '../utilities/isArelNode';
import { Node } from './Node';

type ValuesType = any[];
type AddOtherType = any;

export class FragmentsNode extends Node {
  public values: ValuesType;

  constructor(values: ValuesType = []) {
    super();
    this.values = values;
  }

  override hash = () => hash(this.values);

  add = (other: AddOtherType) => {
    if (!isArelNode(other)) throw new Error('Expected a node');

    return new FragmentsNode([...this.values, other]);
  };
}
