import { UnaryNode } from './Unary';

export class WithNode extends UnaryNode {
  children = () => this.expression;
}
export class WithRecursiveNode extends WithNode {}
