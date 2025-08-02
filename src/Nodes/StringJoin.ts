import { JoinNode } from './Binary';

export class StringJoinNode extends JoinNode {
  public override readonly joinType = 'string';
}
