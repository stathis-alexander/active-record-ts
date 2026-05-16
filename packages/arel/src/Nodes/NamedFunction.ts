import type { Expression } from '../types';
import { hash } from '../utilities/hash';
import { FunctionNode } from './Function';

export class NamedFunctionNode extends FunctionNode {
  public readonly name: string;

  constructor(name: string, expression: Expression | Expression[]) {
    super(expression);
    this.name = name;
  }

  override hash() {
    return hash([this.name, super.hash()]);
  }
}
