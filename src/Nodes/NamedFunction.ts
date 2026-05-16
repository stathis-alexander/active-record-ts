import { hash } from '../utilities/hash';
import { type ExpressionsType, FunctionNode } from './Function';

export class NamedFunctionNode extends FunctionNode {
  public readonly name: string;

  constructor(name: string, expression: ExpressionsType) {
    super(expression);
    this.name = name;
  }

  override hash() {
    return hash([this.name, super.hash()]);
  }
}
