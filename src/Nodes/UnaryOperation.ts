import { UnaryNode } from './Unary';

export class UnaryOperationNode extends UnaryNode {
  public readonly operator: string = '';
}

export class BitwiseNotNode extends UnaryOperationNode {
  public override readonly operator = '~';
}
