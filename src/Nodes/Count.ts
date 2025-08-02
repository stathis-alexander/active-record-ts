import { type ExpressionsType, FunctionNode } from './Function';

export class CountNode extends FunctionNode {
  constructor(expressions: ExpressionsType, distinct: boolean = false) {
    super(expressions);
    this.distinct = distinct;
  }
}
