import { JoinNode } from './Binary';

export class FullOuterJoinNode extends JoinNode {
  public override readonly joinType = 'fullOuter';
}
