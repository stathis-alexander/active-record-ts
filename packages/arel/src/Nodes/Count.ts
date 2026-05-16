import type { Expression } from '../types';
import { FunctionNode } from './Function';

export class CountNode extends FunctionNode {
  constructor(expressions: Expression | Expression[], distinct: boolean = false) {
    super(expressions);
    this.distinct = distinct;
  }
}
