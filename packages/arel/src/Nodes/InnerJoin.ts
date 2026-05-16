import { JoinNode } from './Binary';

export class InnerJoinNode extends JoinNode {
  public override readonly joinType = 'inner';
}
