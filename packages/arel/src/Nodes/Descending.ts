import { AscendingNode } from './Ascending';
import { OrderingNode } from './Ordering';

export class DescendingNode extends OrderingNode {
  public readonly direction: 'desc' = 'desc';

  reverse = () => new AscendingNode(this.expression);

  isAscending = () => false;
  isDescending = () => true;
}
