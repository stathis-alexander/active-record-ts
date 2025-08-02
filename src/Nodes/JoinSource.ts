import { BinaryNode } from './Binary';

type SingleSourceType = any;
type JoinOperationType = any[];

export class JoinSourceNode extends BinaryNode {
  constructor(left: SingleSourceType, right: JoinOperationType = []) {
    super(left, right);
  }

  empty = () => this.left == null && this.right.length === 0;
}
