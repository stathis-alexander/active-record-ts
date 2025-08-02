import { DescendingNode } from './Descending';
import { OrderingNode } from './Ordering';

export class AscendingNode extends OrderingNode {
  public readonly direction: 'asc' = 'asc';

  reverse = () => new DescendingNode(this.expression);

  isAscending = () => true;
  isDescending = () => false;
}
