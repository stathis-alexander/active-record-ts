import type { RelationLike } from '../types';
import type { JoinNode } from './Binary';
import { BinaryNode } from './Binary';

export class JoinSourceNode extends BinaryNode {
  public declare left: RelationLike | undefined | null;
  public declare right: JoinNode[];

  constructor(left: RelationLike | undefined | null, right: JoinNode[] = []) {
    super(left, right);
  }

  empty = () => this.left == null && this.right.length === 0;
}
