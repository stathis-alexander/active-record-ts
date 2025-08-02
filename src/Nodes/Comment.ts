import { hash } from '../utilities/hash';
import { Node } from './Node';

export class CommentNode extends Node {
  public readonly values: string[];

  constructor(values: string[] = []) {
    super();
    this.values = values;
  }

  override hash() {
    return hash(this.values);
  }
}
