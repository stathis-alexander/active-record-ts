import { JoinNode } from './Binary';

export class OuterJoinNode extends JoinNode {
  public override readonly joinType = 'outer';
}
