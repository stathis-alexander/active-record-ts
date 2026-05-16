import { JoinNode } from './Binary';

export class LeadingJoinNode extends JoinNode {
  public override readonly joinType = 'leading';
}
