import { JoinNode } from './Binary';

export class RightOuterJoinNode extends JoinNode {
  public override readonly joinType = 'rightOuter';
}
